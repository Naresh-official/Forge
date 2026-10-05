import { builderConfig } from "@forge/config"
import { createLogger, type Logger } from "@forge/logger"

const logger: Logger = createLogger({
  service: "builder",
  level: builderConfig.nodeEnv === "development" ? "debug" : "info",
})

export default logger
