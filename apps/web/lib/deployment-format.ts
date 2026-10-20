import type {
  DeploymentRuntime,
  DeploymentStatus,
} from "@forge/types/deployment"

/** Statuses that are still moving and therefore worth polling for. */
export const ACTIVE_DEPLOYMENT_STATUSES: readonly DeploymentStatus[] = [
  "QUEUED",
  "BUILDING",
  "DEPLOYING",
]

export function isDeploymentActive(status: string): boolean {
  return ACTIVE_DEPLOYMENT_STATUSES.includes(status as DeploymentStatus)
}

/** The timing fields every deployment row exposes. */
export type DeploymentTiming = {
  status: string
  startedAt: Date | string | null
  completedAt: Date | string | null
}

/** "42s" / "1m 04s" between two instants. */
export function formatElapsed(start: Date, end: Date): string {
  const seconds = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 1000)
  )

  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60

  return `${minutes}m ${String(rest).padStart(2, "0")}s`
}

/**
 * Build + deploy time. A running deployment has no `completedAt` yet, so it
 * reports progress instead of a bogus duration.
 */
export function formatDeploymentDuration(deployment: DeploymentTiming): string {
  if (!deployment.startedAt) {
    return isDeploymentActive(deployment.status) ? "starting" : "—"
  }

  const start = new Date(deployment.startedAt)

  if (!deployment.completedAt) {
    return isDeploymentActive(deployment.status) ? "in progress" : "—"
  }

  return formatElapsed(start, new Date(deployment.completedAt))
}

/** "just now" / "12 min ago" / "2 hours ago" / a local date after a month. */
export function formatRelativeTime(value: Date | string): string {
  const date = new Date(value)
  const seconds = Math.round((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min ago`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  }

  const days = Math.round(hours / 24)
  if (days < 30) {
    return `${days} ${days === 1 ? "day" : "days"} ago`
  }

  return date.toLocaleDateString()
}

/** "Container" / "Static" — for table cells. */
export function runtimeLabel(runtime: DeploymentRuntime): string {
  return runtime === "KUBERNETES" ? "Container" : "Static"
}

/** "Container · Kubernetes" / "Static · object storage" — for detail views. */
export function formatRuntime(runtime: DeploymentRuntime): string {
  return runtime === "KUBERNETES"
    ? "Container · Kubernetes"
    : "Static · object storage"
}
