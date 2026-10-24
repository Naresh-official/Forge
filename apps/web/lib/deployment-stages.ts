import type { DeploymentDetailResponse } from "@forge/types/deployment"
import { formatElapsed } from "./deployment-format"

export type Stage = {
  label: string
  at: Date | null
  until: Date | null
}

function toDate(value: Date | string | null | undefined): Date | null {
  return value ? new Date(value) : null
}

/**
 * The pipeline as Forge actually records it: when the deployment was queued,
 * when the build ran, when the deployer started, and how it ended. There is no
 * separate "uploading" stage timestamp, so it is not invented here.
 */
export function buildStages(deployment: DeploymentDetailResponse): Stage[] {
  const build = deployment.build

  const finishLabel =
    deployment.status === "READY"
      ? "Ready"
      : deployment.status === "FAILED"
        ? "Failed"
        : deployment.status === "CANCELLED"
          ? "Cancelled"
          : "Ready"

  return [
    {
      label: "Queued",
      at: toDate(deployment.createdAt),
      until: toDate(build?.startedAt ?? deployment.startedAt),
    },
    {
      label: "Building",
      at: toDate(build?.startedAt),
      until: toDate(build?.completedAt),
    },
    {
      label: "Deploying",
      at: toDate(deployment.startedAt),
      until: toDate(deployment.completedAt),
    },
    {
      label: finishLabel,
      at: toDate(deployment.completedAt ?? build?.completedAt),
      until: null,
    },
  ]
}

export function stageCaption(
  stage: Stage,
  deployment: DeploymentDetailResponse
) {
  if (stage.at && stage.until) {
    return formatElapsed(stage.at, stage.until)
  }

  if (stage.at) {
    if (deployment.status === "READY") return "completed"
    if (deployment.status === "FAILED" || deployment.status === "CANCELLED") {
      return "stopped"
    }
    return "in progress"
  }

  return "pending"
}

export function stageTone(stage: Stage, deployment: DeploymentDetailResponse) {
  const failed =
    deployment.status === "FAILED" || deployment.status === "CANCELLED"
  const isLast =
    stage.label === "Ready" ||
    stage.label === "Failed" ||
    stage.label === "Cancelled"

  if (stage.at) {
    return "border-primary"
  }

  if (failed && isLast) {
    return "border-rose-500/60"
  }

  return "border-border"
}
