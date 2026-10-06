/**
 * ForgeLogger — the only logging surface the builder (and future services)
 * need. Callers do `logger.info(...)` without knowing anything about Redis
 * or S3.
 *
 * Live path:   every event → Redis pub/sub (+ replay ring buffer)
 * Durable path: events buffer in memory and flush to S3 in chunks, either
 *               when `flushIntervalMs` elapses with pending events, when
 *               `flushBatchSize` events are pending, or on `close()`.
 *
 * `close()` MUST be awaited before a build is reported terminal — it
 * guarantees buffered logs reach S3 (with retries) and returns flush errors
 * to the caller instead of losing them.
 *
 * Redis failures never throw: live delivery is an optional side effect.
 * S3 failures during periodic flushes are retried; the buffered events are
 * re-queued and the failure is finally surfaced by `close()`.
 */

import type { LogEvent, LogEventInput, LogLevel } from "@forge/types/logs"
import { buildLogObjectKey, type LogKind } from "./keys"
import { publishLogEvent } from "./redis"

export interface ForgeLoggerOptions {
  projectId: string
  deploymentId: string
  /** Log subfolder in S3 and `source` field on events ("build"/"runtime"). */
  kind: LogKind
  redis: {
    publish(channel: string, message: string): Promise<number>
    sadd(key: string, ...members: string[]): Promise<number>
    expire(key: string, seconds: number): Promise<number>
  }
  /** Full Redis channel name; `forge:logs:deployment:<id>` by convention. */
  channel: string
  /** Replay ring-buffer key. */
  historyKey: string
  /** Max events kept in the replay ring buffer. */
  historyLimit: number
  /** TTL for the replay ring buffer in milliseconds. */
  historyTtlMs: number
  s3: {
    /**
     * Uploads one chunk. Receives the full object key
     * (`<projectId>/<deploymentId>/<kind>/<timestamp>.log`) and the NDJSON
     * body. Never called with an empty body.
     */
    upload(key: string, body: string): Promise<void>
  }
  /** How often pending buffered events are flushed to S3. */
  flushIntervalMs: number
  /** Max buffered events before an early flush. */
  flushBatchSize: number
  /** Hook for internal diagnostics (pino logger of the host service). */
  onError?: (error: unknown) => void
}

const MAX_FLUSH_ATTEMPTS = 3
const FLUSH_RETRY_DELAY_MS = 1_000

export class ForgeLogger {
  private readonly options: ForgeLoggerOptions
  private buffer: LogEvent[] = []
  private timer: ReturnType<typeof setInterval> | undefined
  private flushing: Promise<void> = Promise.resolve()
  private closed = false

  constructor(options: ForgeLoggerOptions) {
    this.options = options

    if (this.options.flushIntervalMs > 0) {
      this.timer = setInterval(
        () => this.flushBuffered(),
        this.options.flushIntervalMs
      )

      // Never keep a process alive just for log flushing.
      this.timer.unref?.()
    }
  }

  private makeEvent(
    level: LogLevel,
    message: string,
    timestamp: Date
  ): LogEvent {
    return {
      projectId: this.options.projectId,
      deploymentId: this.options.deploymentId,
      source: this.options.kind,
      level,
      timestamp: timestamp.toISOString(),
      message,
    }
  }

  private async emit(event: LogEvent): Promise<void> {
    // Live path — publishLogEvent never throws on Redis failures.
    await publishLogEvent({
      redis: this.options.redis,
      event,
      historyLimit: this.options.historyLimit,
      historyTtlMs: this.options.historyTtlMs,
    })

    // Durable path — buffer for the next S3 flush.
    this.buffer.push(event)

    if (this.buffer.length >= this.options.flushBatchSize) {
      this.flushBuffered()
    }
  }

  private log(level: LogLevel, message: string | LogEventInput): void {
    if (this.closed) {
      return
    }

    const text = typeof message === "string" ? message : message.message

    if (typeof text !== "string") {
      return
    }

    const event = this.makeEvent(level, text, new Date())

    // emit() is async but logging must stay fire-and-forget; failures are
    // reported through onError instead of crashing the host service.
    this.emit(event).catch((error) => this.options.onError?.(error))
  }

  info(message: string | LogEventInput): void {
    this.log("info", message)
  }

  warn(message: string | LogEventInput): void {
    this.log("warn", message)
  }

  error(message: string | LogEventInput): void {
    this.log("error", message)
  }

  private flushBuffered(): void {
    if (this.closed || this.buffer.length === 0) {
      return
    }

    const events = this.buffer
    this.buffer = []

    // Serialize flushes so chunk ordering follows event ordering.
    this.flushing = this.flushing
      .then(() => this.flushWithRetry(events))
      .catch((error) => this.options.onError?.(error))
  }

  private async flushWithRetry(events: LogEvent[]): Promise<void> {
    if (events.length === 0) {
      return
    }

    const key = buildLogObjectKey({
      projectId: this.options.projectId,
      deploymentId: this.options.deploymentId,
      kind: this.options.kind,
      timestamp: new Date(),
    })

    const body = events.map((event) => JSON.stringify(event)).join("\n") + "\n"

    let lastError: unknown

    for (let attempt = 1; attempt <= MAX_FLUSH_ATTEMPTS; attempt++) {
      try {
        await this.options.s3.upload(key, body)

        return
      } catch (error) {
        lastError = error
        this.options.onError?.(error)

        if (attempt < MAX_FLUSH_ATTEMPTS) {
          await new Promise((resolve) =>
            setTimeout(resolve, FLUSH_RETRY_DELAY_MS * attempt)
          )
        }
      }
    }

    // Re-queue the events only while the logger is still open — after
    // close() the caller receives the failure via close()'s return value.
    if (!this.closed) {
      this.buffer.unshift(...events)
    }

    throw lastError
  }

  /**
   * Flushes remaining buffered logs to S3 and stops the logger. Must be
   * awaited before reporting a terminal build status. Returns false when
   * the final flush could not complete (callers decide whether that is
   * fatal — it usually is not).
   */
  async close(): Promise<boolean> {
    if (this.closed) {
      return true
    }

    this.closed = true

    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }

    this.flushBuffered()

    try {
      await this.flushing
      return true
    } catch (error) {
      this.options.onError?.(error)
      return false
    }
  }
}

export function createForgeLogger(options: ForgeLoggerOptions): ForgeLogger {
  return new ForgeLogger(options)
}
