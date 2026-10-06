import { apiConfig } from "@forge/config/api"
import { createLogger, type Logger } from "@forge/logger"

const logger: Logger = createLogger({
  service: "log-router",
  level: apiConfig.nodeEnv === "development" ? "debug" : "info",
})

export default logger
