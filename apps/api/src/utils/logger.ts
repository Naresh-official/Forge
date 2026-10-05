import { apiConfig } from "@forge/config"
import { createLogger, type Logger } from "@forge/logger"

const logger: Logger = createLogger({
  service: "api",
  level: apiConfig.nodeEnv === "development" ? "debug" : "info",
})

export default logger
