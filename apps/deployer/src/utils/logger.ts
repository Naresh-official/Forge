import { deployerConfig } from "@forge/config"
import { createLogger, type Logger } from "@forge/logger"

const logger: Logger = createLogger({
  service: "deployer",
  level: deployerConfig.nodeEnv === "development" ? "debug" : "info",
})

export default logger
