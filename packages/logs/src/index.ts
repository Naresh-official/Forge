/**
 * Shared log types and logging infrastructure for Forge.
 *
 * - `@forge/logs`           — LogEvent types + `ForgeLogger` (Redis live + S3 buffered)
 * - `@forge/logs/redis`     — publisher/subscriber helpers around the channel convention
 * - `@forge/logs/s3`        — chunked S3 log persistence + listing (forge-logs bucket)
 */

export type {
  LogSource,
  LogLevel,
  LogEvent,
  LogEventKubernetesMetadata,
  LogLine,
  GetDeploymentLogsResponse,
  LogEventInput,
} from "@forge/types/logs"

export { logSources, logLevels, logEventSchema } from "@forge/types/logs"

export {
  ForgeLogger,
  createForgeLogger,
  type ForgeLoggerOptions,
} from "./forge-logger"

export {
  buildLogObjectKey,
  parseLogObjectKey,
  isLogKind,
  timestampForLogKey,
  type LogKind,
} from "./keys"
