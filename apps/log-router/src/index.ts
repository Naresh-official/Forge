import { apiConfig } from "@forge/config/api"
import logger from "@/utils/logger"
import type { ForwardServerOptions } from "./forward/server"
import { ForwardServer } from "./forward/server"
import { forwardMessageToLogEvents } from "./forward/records"
import { publishRuntimeEvents, closeRuntimePublisher } from "./publish"

const config: ForwardServerOptions = {
  port: apiConfig.logRouter.port,
  host: "0.0.0.0",
}

const server = new ForwardServer(config, async (message) => {
  logger.debug(
    { tag: message.tag, recordCount: message.records.length },
    "[log-router] Received Forward message"
  )
  const events = forwardMessageToLogEvents(message)

  logger.debug(
    { eventCount: events.length, tag: message.tag },
    "[log-router] Converted to LogEvents"
  )

  if (events.length > 0) {
    await publishRuntimeEvents(events)
    logger.debug(
      { eventCount: events.length },
      "[log-router] Published events to Redis"
    )
  } else {
    logger.debug(
      { tag: message.tag },
      "[log-router] No forge-managed events extracted"
    )
  }
})

server.listen()

logger.info(
  `log-router listening on ${config.host}:${config.port} (Fluent Bit Forward protocol)`
)

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down log-router...`)
  server.close()
  await closeRuntimePublisher()
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
