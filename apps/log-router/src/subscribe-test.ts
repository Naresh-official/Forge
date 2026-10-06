/**
 * Test: subscribe to Redis pub/sub channel while a test Forward message is
 * sent, to verify LIVE event delivery (not just the replay ring buffer).
 *
 * Usage: bun run apps/log-router/src/subscribe-test.ts
 */
import { RedisClient } from "bun"

const deploymentId = "test-deployment-id"
const channel = `forge:logs:deployment:${deploymentId}`
const historyKey = `forge:logs:history:deployment:${deploymentId}`

const redis = new RedisClient(process.env.REDIS_URL || "redis://localhost:6379")

let messageCount = 0
const startTime = Date.now()

console.log(`[subscriber] Subscribing to channel: ${channel}`)

await redis.subscribe(channel, (message, channelName) => {
  messageCount++
  const elapsed = Date.now() - startTime
  console.log(
    `[subscriber] LIVE event received after ${elapsed}ms (channel=${channelName}):`
  )
  try {
    const parsed = JSON.parse(message)
    console.log(`[subscriber]   → ${JSON.stringify(parsed, null, 2)}`)
  } catch {
    console.log(`[subscriber]   → ${message}`)
  }
})

console.log("[subscriber] Subscription active — waiting for live events...")
console.log(`[subscriber] Also checking replay ring buffer at ${historyKey}...`)

const history = await redis.smembers(historyKey)
console.log(`[subscriber] Replay ring buffer has ${history.length} entries`)

// Wait for live events for up to 10 seconds.
setTimeout(async () => {
  console.log(
    `[subscriber] Done. Received ${messageCount} live events in ${
      Date.now() - startTime
    }ms.`
  )
  await redis.quit()
  process.exit(0)
}, 10_000)
