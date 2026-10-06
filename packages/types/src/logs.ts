import z from "zod"

/** Where a log event originates from. */
export type LogSource = "builder" | "runtime"

export const logSources: LogSource[] = ["builder", "runtime"]

export type LogLevel = "info" | "warn" | "error"

export const logLevels: LogLevel[] = ["info", "warn", "error"]

/**
 * The canonical structured log event.
 *
 * Build logs are emitted by the builder itself; runtime logs are collected
 * from application stdout/stderr by Fluent Bit and mapped into this shape by
 * the log-router before they reach the API. Both travel over the same Redis
 * channel convention and both persist to the same S3 bucket layout.
 */
export interface LogEvent {
  projectId: string
  deploymentId: string
  source: LogSource
  level: LogLevel
  /** ISO-8601 UTC timestamp. */
  timestamp: string
  message: string
  /** Runtime only (when available): Kubernetes metadata. */
  kubernetes?: LogEventKubernetesMetadata
}

export interface LogEventKubernetesMetadata {
  /** Deployment namespace: forge-project-<projectId>-<deploymentId>. */
  namespace?: string
  /** Pod name. Informational — never the sole deployment identifier. */
  pod?: string
  /** Container name within the pod. */
  container?: string
  /** Node the pod is scheduled on, when known. */
  node?: string
}

/**
 * A single parsed log line as returned by the historical log API. Runtime
 * events carry `kubernetes` metadata; build events do not.
 */
export interface LogLine {
  timestamp: string
  level: LogLevel
  source: LogSource
  message: string
  kubernetes?: LogEventKubernetesMetadata
}

export interface GetDeploymentLogsResponse {
  deploymentId: string
  /** `build` (build logs) or `runtime` (application logs). */
  type: LogSource
  /** Object keys included in this page, oldest first. */
  chunks: string[]
  /** Parsed log lines across the returned chunks. */
  lines: LogLine[]
  /** When true, more chunks exist after `nextCursor`. */
  hasMore: boolean
  /** S3 continuation token for the next page; undefined when exhausted. */
  nextCursor?: string
}

/** Deliberately conservative — malformed events are dropped, not thrown on. */
export const logEventSchema = z.object({
  projectId: z.string().min(1),
  deploymentId: z.string().min(1),
  source: z.enum(["builder", "runtime"]),
  level: z.enum(["info", "warn", "error"]),
  timestamp: z.string().min(1),
  message: z.string(),
  kubernetes: z
    .object({
      namespace: z.string().optional(),
      pod: z.string().optional(),
      container: z.string().optional(),
      node: z.string().optional(),
    })
    .optional(),
})

export type LogEventInput = z.input<typeof logEventSchema>
