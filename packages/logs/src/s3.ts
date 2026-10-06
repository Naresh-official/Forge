/**
 * S3 log persistence for the shared `forge-logs` bucket.
 *
 * Logs are NEVER uploaded one object per line — the logger buffers events
 * in memory and flushes them as chunked objects under
 * `<projectId>/<deploymentId>/{build,runtime}/<timestamp>.log`.
 *
 * Uses the same AWS SDK setup as `@forge/storage` (env-based credentials,
 * region from config) so no second S3 implementation or hardcoded
 * credentials are introduced. An optional endpoint override keeps the module
 * testable against MinIO and lets the Fluent Bit S3 output target the same
 * bucket through its own (IAM/env) credentials.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  type _Object,
} from "@aws-sdk/client-s3"
import type {
  LogEvent,
  LogLine,
  GetDeploymentLogsResponse,
} from "@forge/types/logs"
import { isLogKind, parseLogObjectKey } from "./keys"

export interface LogsStorageConfig {
  bucket: string
  region: string
  /** Optional S3-compatible endpoint (e.g. MinIO in development). */
  endpoint?: string
  /** Optional static credentials; defaults to the AWS credential chain. */
  accessKeyId?: string
  secretAccessKey?: string
  /** Force path-style addressing (required for MinIO). */
  forcePathStyle?: boolean
}

export function createLogsStorageClient(config: LogsStorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    ...(config.forcePathStyle ? { forcePathStyle: true } : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
    /*
     * S3 requires every aws-chunked chunk except the last to be >= 8 KiB.
     * Without this buffer the SDK does not coalesce small stream chunks
     * (see @forge/storage, aws-sdk-js-v3#7509).
     */
    requestStreamBufferSize: 8 * 1024,
  })
}

export interface UploadLogChunkInput {
  client: S3Client
  bucket: string
  /** Full object key including bucket prefix, e.g. p/d/build/<ts>.log. */
  key: string
  events: LogEvent[]
}

/**
 * Serializes events as one JSON object per line (NDJSON) so chunks stay
 * machine-parseable and streamable forever.
 */
export function serializeLogEvents(events: LogEvent[]): string {
  return events.map((event) => JSON.stringify(event)).join("\n") + "\n"
}

export async function uploadLogChunk(
  input: UploadLogChunkInput
): Promise<void> {
  const { client, bucket, key, events } = input

  if (events.length === 0) {
    return
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: serializeLogEvents(events),
      ContentType: "text/plain; charset=utf-8",
    })
  )
}

function parseLogLine(raw: string): LogLine | undefined {
  try {
    const parsed = logEventFromJson(JSON.parse(raw))

    return {
      timestamp: parsed.timestamp,
      level: parsed.level,
      source: parsed.source,
      message: parsed.message,
      ...(parsed.kubernetes ? { kubernetes: parsed.kubernetes } : {}),
    }
  } catch {
    // Tolerate stray non-JSON lines rather than failing the whole chunk.
    return {
      timestamp: "",
      level: "info",
      source: "runtime",
      message: raw,
    }
  }
}

function logEventFromJson(value: unknown): LogEvent {
  // Narrow runtime validation without pulling Zod into this module twice —
  // the shape is fully owned by us (we wrote it), so this only guards
  // against corrupted objects.
  const event = value as LogEvent

  if (
    typeof event !== "object" ||
    event === null ||
    typeof event.timestamp !== "string" ||
    typeof event.message !== "string"
  ) {
    throw new Error("Malformed log event")
  }

  return event
}

/**
 * Lists log chunks for a deployment (oldest first), paginated with the S3
 * continuation token so unbounded histories are never fully loaded.
 */
export async function listLogChunks(input: {
  client: S3Client
  bucket: string
  projectId: string
  deploymentId: string
  kind: "build" | "runtime"
  maxKeys?: number
  continuationToken?: string
}): Promise<{
  keys: string[]
  nextContinuationToken?: string
  isTruncated: boolean
}> {
  const {
    client,
    bucket,
    projectId,
    deploymentId,
    kind,
    maxKeys = 100,
    continuationToken,
  } = input

  const prefix = `${projectId}/${deploymentId}/${kind}/`

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      MaxKeys: maxKeys,
      ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
    })
  )

  const contents: _Object[] = response.Contents ?? []

  return {
    keys: contents
      .map((object) => object.Key)
      .filter((key): key is string => typeof key === "string")
      .sort(),
    ...(response.NextContinuationToken
      ? { nextContinuationToken: response.NextContinuationToken }
      : {}),
    isTruncated: response.IsTruncated ?? false,
  }
}

async function getObjectBody(client: S3Client, bucket: string, key: string) {
  const response = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  )

  return (await response.Body?.transformToString("utf-8")) ?? ""
}

export interface GetDeploymentLogsInput {
  client: S3Client
  bucket: string
  projectId: string
  deploymentId: string
  kind: "build" | "runtime"
  /** Max S3 chunks to load per page (each chunk is a bounded file). */
  pageSize?: number
  continuationToken?: string
}

/**
 * Loads a bounded page of persisted logs. Only `pageSize` chunks are read —
 * callers paginate with `nextCursor` for older/newer content, so memory use
 * stays flat no matter how large the deployment's log history is.
 */
export async function getDeploymentLogs(
  input: GetDeploymentLogsInput
): Promise<GetDeploymentLogsResponse> {
  const {
    client,
    bucket,
    projectId,
    deploymentId,
    kind,
    pageSize = 50,
    continuationToken,
  } = input

  const listing = await listLogChunks({
    client,
    bucket,
    projectId,
    deploymentId,
    kind,
    maxKeys: pageSize,
    continuationToken,
  })

  const lines: LogLine[] = []

  for (const key of listing.keys) {
    const body = await getObjectBody(client, bucket, key)

    for (const raw of body.split("\n")) {
      const trimmed = raw.trim()

      if (trimmed.length === 0) {
        continue
      }

      lines.push(parseLogLine(trimmed))
    }
  }

  return {
    deploymentId,
    type: kind,
    chunks: listing.keys,
    lines,
    hasMore: listing.isTruncated,
    ...(listing.nextContinuationToken
      ? { nextCursor: listing.nextContinuationToken }
      : {}),
  }
}

/**
 * Best-effort variant used on flush paths: failures are returned, not
 * thrown, so a broken S3 connection can never fail a build.
 */
export async function tryUploadLogChunk(
  input: UploadLogChunkInput
): Promise<{ ok: boolean; error?: unknown }> {
  try {
    await uploadLogChunk(input)

    return { ok: true }
  } catch (error) {
    return { ok: false, error }
  }
}

export { isLogKind, parseLogObjectKey }
