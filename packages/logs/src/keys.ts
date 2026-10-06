/**
 * S3 object key layout for the shared `forge-logs` bucket:
 *
 *   <projectId>/<deploymentId>/build/2026-10-05T13-00-00.log
 *   <projectId>/<deploymentId>/runtime/2026-10-05T13-05-00.log
 *
 * One bucket for every project and deployment; logs are separated purely by
 * prefix. Timestamps use `-` instead of `:` so the keys are shell-friendly.
 */

export type LogKind = "build" | "runtime"

const LOG_KINDS: readonly LogKind[] = ["build", "runtime"]

export function isLogKind(value: string): value is LogKind {
  return (LOG_KINDS as readonly string[]).includes(value)
}

/** S3-safe timestamp for object keys: 2026-10-05T13-00-00(.123).log */
export function timestampForLogKey(date: Date): string {
  return date.toISOString().replaceAll(":", "-")
}

export function buildLogObjectKey(input: {
  projectId: string
  deploymentId: string
  kind: LogKind
  timestamp?: Date
}): string {
  const { projectId, deploymentId, kind, timestamp = new Date() } = input

  return [
    projectId,
    deploymentId,
    kind,
    `${timestampForLogKey(timestamp)}.log`,
  ].join("/")
}

/**
 * Parses `<projectId>/<deploymentId>/<kind>/<timestamp>.log` back into its
 * parts. Returns null for keys that do not match the layout.
 */
export function parseLogObjectKey(key: string):
  | {
      projectId: string
      deploymentId: string
      kind: LogKind
    }
  | undefined {
  const parts = key.split("/")

  // Keys may nest deeper (Fluent Bit $INDEX chunks) — the first four
  // segments are what matter.
  if (parts.length < 4) {
    return undefined
  }

  const [projectId, deploymentId, kind] = parts

  if (!projectId || !deploymentId || !kind || !isLogKind(kind)) {
    return undefined
  }

  return {
    projectId,
    deploymentId,
    kind,
  }
}
