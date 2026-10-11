import type { ForgeLogger } from "@forge/logs"
import { createForgeLogger } from "@forge/logs"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { builderConfig } from "@forge/config"
import { createLogsStorageClient } from "@forge/logs/s3"
import {
  logChannelForDeployment,
  logHistoryKeyForDeployment,
} from "@forge/logs/redis"
import internalLogger from "@/utils/logger"

/**
 * Bridges the builder's command-output style (stdout/stderr data chunks) to
 * the shared ForgeLogger. Stream chunks are split into lines so each log
 * event carries exactly one line — what the dashboard renders.
 */

/**
 * The part of the logger build strategies need: they only *write* command
 * output. They never own the logger's lifetime — the worker creates one
 * logger per build and closes it once, in its `finally`, so that every step
 * (install, build, push) appends to the same ordered buffer.
 */
export interface BuildOutputLogger {
  stdout(data: string): void
  stderr(data: string): void
}

export interface BuildLogger extends BuildOutputLogger {
  /** Flushes buffered logs to S3; await before reporting terminal status. */
  close(): Promise<boolean>
}

const storage = createLogsStorageClient({
  bucket: builderConfig.logs.bucket,
  region: builderConfig.logs.region,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  ...(process.env.S3_FORCE_PATH_STYLE === "true"
    ? { forcePathStyle: true }
    : {}),
})

export interface ForgeBuildLoggerOptions {
  projectId: string
  deploymentId: string
}

export function createForgeBuildLogger(
  options: ForgeBuildLoggerOptions
): ForgeLogger & BuildLogger {
  const forgeLogger = createForgeLogger({
    projectId: options.projectId,
    deploymentId: options.deploymentId,
    kind: "build",
    redis: {
      publish: (channel, message) =>
        // One dedicated client per logger instance keeps subscriber state on
        // the API side; builders only publish.
        getRedis().publish(channel, message),
      sadd: (key, ...members) => getRedis().sadd(key, ...members),
      expire: (key, seconds) => getRedis().expire(key, seconds),
    },
    channel: logChannelForDeployment(options.deploymentId),
    historyKey: logHistoryKeyForDeployment(options.deploymentId),
    historyLimit: builderConfig.logs.liveHistoryLimit,
    historyTtlMs: builderConfig.logs.liveHistoryTtlMs,
    s3: {
      upload: async (key, body) => {
        await storage.send(
          new PutObjectCommand({
            Bucket: builderConfig.logs.bucket,
            Key: key,
            Body: body,
            ContentType: "text/plain; charset=utf-8",
          })
        )
      },
    },
    flushIntervalMs: builderConfig.logs.flushIntervalMs,
    flushBatchSize: builderConfig.logs.flushBatchSize,
    onError: (error) => {
      internalLogger.warn(
        { error },
        "[build-logs] Non-fatal log pipeline failure"
      )
    },
  })

  let pending = ""

  function write(data: string, stream: "stdout" | "stderr"): void {
    pending += data

    const lines = pending.split("\n")

    // Keep the trailing partial line in the buffer until its newline
    // arrives (stream chunks split mid-line all the time).
    pending = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "")

      if (trimmed.trim().length === 0) {
        continue
      }

      forgeLogger[classifyStreamLine(stream, trimmed)](trimmed)
    }
  }

  /*
   * Attach the command-output helpers to the logger instance itself. The
   * ForgeLogger methods (info/warn/error/close) live on the prototype, so a
   * plain object literal / spread would drop them — `buildLogger.info` and
   * `buildLogger.error` would then be undefined at runtime.
   *
   * `close` is shadowed by the BuildLogger version, so bind the original
   * before assigning to avoid recursing into the override.
   */
  const closeForgeLogger = forgeLogger.close.bind(forgeLogger)

  return Object.assign(forgeLogger, {
    stdout(data: string) {
      write(data, "stdout")
    },

    stderr(data: string) {
      write(data, "stderr")
    },

    async close(): Promise<boolean> {
      // Flush a trailing partial line, if any.
      if (pending.trim().length > 0) {
        forgeLogger.info(pending.replace(/\r$/, ""))
        pending = ""
      }

      return closeForgeLogger()
    },
  })
}

/*
 * stderr is *not* an error channel. Package managers and Docker/build tools
 * write normal progress, deprecation notices and warnings to stderr, so
 * mapping every stderr line to `error` painted healthy builds red and buried
 * the one line that actually failed. Classify by content instead: only lines
 * that look like a genuine failure get `error`; warnings stay warnings and
 * everything else is ordinary output.
 */
const ERROR_LINE_PATTERN =
  /\b(err|error|failed|failure|fatal|exception|panic)\b/i
const WARN_LINE_PATTERN = /\b(warn|warning|deprecated|deprecation)\b/i

export function classifyStreamLine(
  stream: "stdout" | "stderr",
  line: string
): "info" | "warn" | "error" {
  if (stream === "stdout") {
    return "info"
  }

  if (ERROR_LINE_PATTERN.test(line)) {
    return "error"
  }

  if (WARN_LINE_PATTERN.test(line)) {
    return "warn"
  }

  return "info"
}

let redisClient: import("bun").RedisClient | undefined

function getRedis(): import("bun").RedisClient {
  redisClient ??= new Bun.RedisClient(builderConfig.redisUrl)

  return redisClient
}
