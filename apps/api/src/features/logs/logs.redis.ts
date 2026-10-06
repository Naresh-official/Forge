import { RedisClient } from "bun"
import { apiConfig } from "@forge/config"
import { readLogHistory } from "@forge/logs/redis"
import type { LogEvent } from "@forge/types/logs"
import logger from "@/utils/logger"

/**
 * Live log transport between Redis and SSE clients.
 *
 * One dedicated RedisClient per SSE connection (Bun's subscribe puts the
 * whole connection into subscribe mode), created lazily on first use and
 * closed when the last subscriber for a deployment disconnects.
 *
 * Every operation is best-effort: a Redis outage must degrade log streaming
 * to "no live events", never break API requests.
 */

interface Subscription {
  client?: RedisClient
  listener: (event: LogEvent) => void
  /**
   * Set while we are tearing the client down ourselves, so the `onclose`
   * hook does not report a normal disconnect as a failure.
   */
  closing?: boolean
}

const subscriptions = new Map<string, Set<Subscription>>()

function createSubscriberClient(): RedisClient {
  return new RedisClient(apiConfig.redisUrl)
}

export interface LiveLogSubscription extends Disposable {
  /** Replay of recent events captured before this subscription existed. */
  history: LogEvent[]
}

/**
 * Subscribes to live log events for a deployment. Returns the replay
 * history (best-effort) and a disposer that cleans the subscription up.
 * Safe to call during a Redis outage — it resolves with empty history and
 * a subscription that simply never fires.
 */
export async function subscribeToDeploymentLogs(
  deploymentId: string,
  onEvent: (event: LogEvent) => void
): Promise<LiveLogSubscription> {
  const channel = `forge:logs:deployment:${deploymentId}`

  const subscription: Subscription = {
    listener: onEvent,
  }

  const subscribers = subscriptions.get(channel) ?? new Set()
  subscriptions.set(channel, subscribers)
  subscribers.add(subscription)

  let history: LogEvent[] = []

  try {
    const client = createSubscriberClient()
    subscription.client = client

    client.onclose = (error) => {
      if (subscription.closing) {
        return
      }

      logger.warn(
        `[logs-redis] Subscriber disconnected: ${error?.message ?? "unknown"}`
      )
    }

    await client.subscribe(channel, (message) => {
      try {
        const parsed = JSON.parse(message) as LogEvent

        if (
          typeof parsed?.timestamp === "string" &&
          typeof parsed?.message === "string" &&
          typeof parsed?.level === "string"
        ) {
          subscription.listener(parsed)
        }
      } catch {
        // Ignore malformed payloads.
      }
    })

    // Read the replay ring buffer only after the live subscription is
    // active — events published between history read and subscribe would
    // otherwise be missed; duplicates (history ∩ live) are filtered by the
    // consumer via event timestamps/ids.
    history = await readLogHistory(client, deploymentId)
  } catch (error) {
    logger.warn(
      { error },
      `[logs-redis] Live log subscription unavailable for ${deploymentId}`
    )
  }

  return {
    history,

    [Symbol.dispose]() {
      const set = subscriptions.get(channel)

      if (set) {
        set.delete(subscription)

        if (set.size === 0) {
          subscriptions.delete(channel)
        }
      }

      const client = subscription.client

      if (!client) {
        return
      }

      subscription.closing = true

      /*
       * Cleanup must never throw. `unsubscribe` can reject and Bun's
       * `close()` throws ERR_REDIS_CONNECTION_CLOSED when the connection is
       * already gone (e.g. Redis closed it, or unsubscribing from the last
       * channel tore it down). Either way the SSE request is ending and
       * there is nothing left to clean up.
       */
      try {
        void Promise.resolve(client.unsubscribe(channel)).catch(() => {})
      } catch {
        // Best-effort — ignore.
      }

      try {
        client.close()
      } catch {
        // Already closed — nothing to do.
      }
    },
  }
}
