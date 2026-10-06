/**
 * Runtime log publisher for the log-router.
 *
 * Fluent Bit forward records arrive here as an array of `LogEvent`s. Each
 * event is immediately published to the deployment's Redis live channel and
 * replay ring buffer (same convention as the builder), so the API's SSE
 * bridge picks them up in real time.
 *
 * Events are also buffered and flushed to S3 periodically (and on shutdown)
 * for historical retrieval, using the same `<projectId>/<deploymentId>/runtime/...`
 * layout as build logs.
 */

import { RedisClient } from "bun"
import { apiConfig } from "@forge/config/api"
import { publishLogEvent, type LogPublisher } from "@forge/logs/redis"
import { createLogsStorageClient, uploadLogChunk } from "@forge/logs/s3"
import { buildLogObjectKey, type LogKind } from "@forge/logs"
import type { LogEvent } from "@forge/types/logs"
import logger from "@/utils/logger"

/** How often buffered runtime events are flushed to S3. */
const FLUSH_INTERVAL_MS = 2_000
/** Flush early once this many events accumulate per deployment. */
const FLUSH_BATCH_SIZE = 100

interface DeploymentBuffer {
  events: LogEvent[]
  timer: ReturnType<typeof setInterval> | undefined
}

const buffers = new Map<string, DeploymentBuffer>()
let redisClient: RedisClient | undefined

function getRedis(): LogPublisher {
  redisClient ??= new RedisClient(apiConfig.redisUrl)
  return redisClient
}

const storage = createLogsStorageClient({
  bucket: apiConfig.logs.bucket,
  region: apiConfig.logs.region,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  ...(process.env.S3_FORCE_PATH_STYLE === "true"
    ? { forcePathStyle: true }
    : {}),
})

function getBuffer(deploymentId: string): DeploymentBuffer {
  let buffer = buffers.get(deploymentId)

  if (!buffer) {
    buffer = { events: [], timer: undefined }
    buffers.set(deploymentId, buffer)

    // Periodic flush — unref so it never keeps the process alive alone.
    buffer.timer = setInterval(
      () => flushBuffer(deploymentId),
      FLUSH_INTERVAL_MS
    )
    buffer.timer.unref?.()
  }

  return buffer
}

async function flushBuffer(deploymentId: string): Promise<void> {
  const buffer = buffers.get(deploymentId)

  if (!buffer || buffer.events.length === 0) {
    return
  }

  const events = buffer.events
  buffer.events = []

  const first = events[0]!
  if (!first) return

  const key = buildLogObjectKey({
    projectId: first.projectId,
    deploymentId,
    kind: "runtime" as LogKind,
    timestamp: new Date(),
  })

  await uploadLogChunk({
    client: storage,
    bucket: apiConfig.logs.bucket,
    key,
    events,
  })
}

/**
 * Publishes a batch of runtime log events.
 *
 * Each event is forwarded to Redis (live + replay) immediately for real-time
 * SSE delivery. Events are also buffered per-deployment and flushed to S3
 * in chunks for history.
 */
export async function publishRuntimeEvents(events: LogEvent[]): Promise<void> {
  const redis = getRedis()

  logger.debug(
    { eventCount: events.length },
    "[log-router] Publishing events to Redis"
  )

  for (const event of events) {
    try {
      await publishLogEvent({
        redis,
        event,
        historyLimit: apiConfig.liveHistoryLimit,
        historyTtlMs: apiConfig.liveHistoryTtlMs,
      })
    } catch (error) {
      logger.warn(
        { error, deploymentId: event.deploymentId },
        "[log-router] Failed to publish event to Redis"
      )
    }
  }

  // Buffer into S3 for history. Group by deployment so each chunk stays
  // within a single project/deployment prefix.
  const byDeployment = new Map<string, LogEvent[]>()

  for (const event of events) {
    const list = byDeployment.get(event.deploymentId) ?? []
    list.push(event)
    byDeployment.set(event.deploymentId, list)
  }

  for (const [deploymentId, group] of byDeployment) {
    const buffer = getBuffer(deploymentId)
    buffer.events.push(...group)

    if (buffer.events.length >= FLUSH_BATCH_SIZE) {
      void flushBuffer(deploymentId)
    }
  }
}

/** Flush all pending buffers and close the Redis client on shutdown. */
export async function closeRuntimePublisher(): Promise<void> {
  for (const deploymentId of buffers.keys()) {
    try {
      await flushBuffer(deploymentId)
    } catch (error) {
      logger.warn(
        { error, deploymentId },
        "[log-router] Failed to flush buffer on shutdown"
      )
    }
  }

  buffers.clear()

  if (redisClient) {
    redisClient.close()
    redisClient = undefined
  }
}
