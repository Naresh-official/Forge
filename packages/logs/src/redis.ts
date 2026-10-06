/**
 * Redis live-log transport.
 *
 * Channel convention: `forge:logs:deployment:<deploymentId>`.
 *
 * The API publishes nothing here — the builder (build logs) and the
 * log-router (runtime logs from Fluent Bit) publish; the API subscribes and
 * bridges events to browsers over SSE.
 *
 * Every helper is best-effort: a Redis outage must never break a build or a
 * running application, so failures are swallowed (logged) rather than thrown.
 *
 * Two storage layers coexist:
 * - pub/sub delivers live events to whoever is subscribed right now
 * - a per-deployment SET (ring buffer, TTL'd) lets late subscribers replay
 *   recent events so a log viewer connecting mid-build still shows history
 */

import type { LogEvent } from "@forge/types/logs"
import { logEventSchema } from "@forge/types/logs"

/** Redis channel carrying live log events for a deployment. */
export function logChannelForDeployment(deploymentId: string): string {
  return `forge:logs:deployment:${deploymentId}`
}

/** Redis key of the per-deployment replay ring buffer (a SET of events). */
export function logHistoryKeyForDeployment(deploymentId: string): string {
  return `forge:logs:history:deployment:${deploymentId}`
}

/** Publisher interface satisfied by Bun.RedisClient. */
export interface LogPublisher {
  publish(channel: string, message: string): Promise<number>
  sadd(key: string, ...members: string[]): Promise<number>
  expire(key: string, seconds: number): Promise<number>
}

export interface PublishLogEventOptions {
  redis: LogPublisher
  event: LogEvent
  /** Max entries kept in the replay ring buffer. */
  historyLimit: number
  /** TTL for the replay ring buffer, in milliseconds. */
  historyTtlMs: number
}

/**
 * Publishes a log event to the live channel and records it in the replay
 * ring buffer. Best-effort: never throws on Redis failures.
 */
export async function publishLogEvent(
  options: PublishLogEventOptions
): Promise<void> {
  const { redis, event, historyLimit, historyTtlMs } = options
  const payload = JSON.stringify(event)

  try {
    await redis.publish(logChannelForDeployment(event.deploymentId), payload)
  } catch {
    // Live delivery failed — persistence may still succeed.
  }

  try {
    const count = await redis.sadd(
      logHistoryKeyForDeployment(event.deploymentId),
      payload
    )

    if (count > 0 && historyLimit > 0) {
      // Cheap-enough trimming: keep the newest `historyLimit` events. SETs
      // have no order, so we drop arbitrary members when over the limit —
      // replay history is best-effort by design.
      if (count > historyLimit) {
        const members = await (
          redis as {
            smembers(key: string): Promise<string[]>
          }
        ).smembers(logHistoryKeyForDeployment(event.deploymentId))

        const excess = members.length - historyLimit

        if (excess > 0) {
          await (
            redis as {
              srem(key: string, ...members: string[]): Promise<number>
            }
          ).srem(
            logHistoryKeyForDeployment(event.deploymentId),
            ...members.slice(0, excess)
          )
        }
      }

      await redis.expire(
        logHistoryKeyForDeployment(event.deploymentId),
        Math.max(1, Math.ceil(historyTtlMs / 1000))
      )
    }
  } catch {
    // Replay history is optional.
  }
}

/** Subscriber interface satisfied by Bun.RedisClient. */
export interface LogSubscriber {
  subscribe(
    channel: string,
    listener: (message: string, channel: string) => void
  ): Promise<number>
  unsubscribe(channel: string): Promise<void>
  smembers(key: string): Promise<string[]>
}

/**
 * Reads the replay ring buffer for a deployment. Returns parsed events in
 * insertion-insensitive order (sorted by timestamp, oldest first). An empty
 * array is normal when the buffer expired or Redis was restarted.
 */
export async function readLogHistory(
  redis: LogSubscriber,
  deploymentId: string
): Promise<LogEvent[]> {
  let members: string[]

  try {
    members = await redis.smembers(logHistoryKeyForDeployment(deploymentId))
  } catch {
    return []
  }

  const events: LogEvent[] = []

  for (const member of members) {
    try {
      const parsed = logEventSchema.parse(JSON.parse(member))
      events.push(parsed)
    } catch {
      // Skip malformed entries.
    }
  }

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}
