/**
 * Converts Fluent Bit Forward protocol records into Forge `LogEvent`s.
 *
 * Fluent Bit's kubernetes filter enriches each log record with metadata under
 * a `kubernetes` key: namespace_name, pod_name, container_name, host, and
 * crucially `labels` — which is where the forge.dev identity labels live
 * (stamped on the pod template by the deployer).
 *
 * Record shape (after the kubernetes filter):
 *   {
 *     log:   "the raw stdout/stderr line",
 *     stream: "stdout" | "stderr",
 *     kubernetes: {
 *       namespace_name: "...",
 *       pod_name: "...",
 *       container_name: "...",
 *       host: "...",
 *       labels: {
 *         "forge.dev/project-id": "..."
 *         "forge.dev/deployment-id": "..."
 *       }
 *     }
 *   }
 */

import type { ForwardMessage, ForwardRecord } from "./server"
import type { LogEvent } from "@forge/types/logs"

/** Extracts the log line text from a Fluent Bit record. */
function extractMessage(record: Record<string, unknown>): string {
  // Fluent Bit default: the raw log line is under "log"
  const log = record.log
  if (typeof log === "string" && log.length > 0) {
    return log
  }

  // Some setups use "message" instead
  const message = record.message
  if (typeof message === "string" && message.length > 0) {
    return message
  }

  return ""
}

/** Determines log level from the stream name. */
function levelFromStream(
  record: Record<string, unknown>
): "info" | "warn" | "error" {
  // stderr → error, stdout → info (warn is not directly detectable;
  // applications can structure their JSON logs to set the level field,
  // but most container stdout is informational).
  if (record.stream === "stderr") {
    return "error"
  }
  return "info"
}

/** Extracts Kubernetes metadata from a Fluent Bit record. */
function extractKubernetesMetadata(
  record: Record<string, unknown>
): LogEvent["kubernetes"] {
  const k8s = record.kubernetes

  if (typeof k8s !== "object" || k8s === null) {
    return undefined
  }

  const meta = k8s as Record<string, unknown>

  const namespace =
    typeof meta.namespace_name === "string" ? meta.namespace_name : undefined
  const pod = typeof meta.pod_name === "string" ? meta.pod_name : undefined
  const container =
    typeof meta.container_name === "string" ? meta.container_name : undefined
  const node = typeof meta.host === "string" ? meta.host : undefined

  if (
    namespace === undefined &&
    pod === undefined &&
    container === undefined &&
    node === undefined
  ) {
    return undefined
  }

  return {
    ...(namespace ? { namespace } : {}),
    ...(pod ? { pod } : {}),
    ...(container ? { container } : {}),
    ...(node ? { node } : {}),
  }
}

/** Extracts the forge.dev identity labels from kubernetes metadata. */
function extractIds(record: Record<string, unknown>): {
  projectId?: string
  deploymentId?: string
} {
  const k8s = record.kubernetes

  if (typeof k8s !== "object" || k8s === null) {
    return {}
  }

  const meta = k8s as Record<string, unknown>
  const labels = meta.labels

  if (typeof labels !== "object" || labels === null) {
    return {}
  }

  const labelMap = labels as Record<string, unknown>

  return {
    projectId:
      typeof labelMap["forge.dev/project-id"] === "string"
        ? (labelMap["forge.dev/project-id"] as string)
        : undefined,
    deploymentId:
      typeof labelMap["forge.dev/deployment-id"] === "string"
        ? (labelMap["forge.dev/deployment-id"] as string)
        : undefined,
  }
}

/**
 * Converts a single Fluent Bit record into a LogEvent.
 * Returns undefined when the record lacks the forge identity labels
 * (e.g. infra pods that aren't part of any deployment).
 */
export function forwardRecordToLogEvent(
  record: ForwardRecord
): LogEvent | undefined {
  const rec = record.record
  if (typeof rec !== "object" || rec === null) {
    return undefined
  }

  const ids = extractIds(rec)
  if (!ids.projectId || !ids.deploymentId) {
    // Not a Forge-managed pod — skip the record.
    return undefined
  }

  const message = extractMessage(rec)
  if (message.length === 0) {
    return undefined
  }

  return {
    projectId: ids.projectId,
    deploymentId: ids.deploymentId,
    source: "runtime",
    level: levelFromStream(rec),
    timestamp: new Date(record.timestamp * 1000).toISOString(),
    message,
    ...(extractKubernetesMetadata(rec)
      ? { kubernetes: extractKubernetesMetadata(rec) }
      : {}),
  }
}

/**
 * Converts an entire Fluent Bit Forward message into an array of LogEvents.
 * Records without forge identity labels are silently dropped — they belong
 * to infrastructure pods, not user deployments.
 */
export function forwardMessageToLogEvents(message: ForwardMessage): LogEvent[] {
  const events: LogEvent[] = []

  for (const record of message.records) {
    const event = forwardRecordToLogEvent(record)
    if (event !== undefined) {
      events.push(event)
    }
  }

  return events
}
