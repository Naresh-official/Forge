import { DEPLOYMENT_PLANS, type DeploymentPlan } from "@forge/types/deployment"
import type { ResourceAllocation } from "@forge/types/resources"

/** "500m" / "2 cores" — millicores to a readable CPU amount. */
export function formatCpu(millicores: number) {
  if (millicores >= 1000) {
    const cores = millicores / 1000
    return `${cores.toFixed(millicores % 1000 === 0 ? 0 : 1)} ${
      cores === 1 ? "core" : "cores"
    }`
  }

  return `${Math.round(millicores)}m`
}

/** "512 MB" / "2 GB" — MiB to a readable memory/storage amount. */
export function formatMemory(mb: number) {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
  }

  return `${Math.round(mb)} MB`
}

/**
 * The plan a stored allocation corresponds to, or null when the deployment
 * carries custom values (e.g. a plan that no longer exists).
 */
export function planForAllocation(
  allocation: ResourceAllocation
): DeploymentPlan | null {
  return (
    Object.values(DEPLOYMENT_PLANS).find(
      (candidate) =>
        candidate.cpuMillicores === allocation.cpuMillicores &&
        candidate.memoryMb === allocation.memoryMb &&
        candidate.ephemeralStorageMb === allocation.ephemeralStorageMb
    ) ?? null
  )
}
