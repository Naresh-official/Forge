import type { ContainerResources } from "./types"

/** Labels applied to every Kubernetes resource Forge creates. */
export const FORGE_MANAGED_BY_LABELS = {
  "app.kubernetes.io/managed-by": "forge",
} as const

/**
 * Fallback resources used when a deployment carries no resource plan.
 * Mirrors the Basic plan (500m CPU / 512Mi memory / 2048Mi storage).
 */
const FALLBACK_RESOURCES: ContainerResources = {
  cpuMillicores: 500,
  memoryMb: 512,
  ephemeralStorageMb: 2048,
}

/**
 * Builds the container `resources` block from a deployment's resource plan.
 * Requests equal limits, which gives the pod Guaranteed QoS.
 */
export function buildContainerResources(resources?: ContainerResources) {
  const cpu =
    resources?.cpuMillicores && resources.cpuMillicores > 0
      ? resources.cpuMillicores
      : FALLBACK_RESOURCES.cpuMillicores

  const memory =
    resources?.memoryMb && resources.memoryMb > 0
      ? resources.memoryMb
      : FALLBACK_RESOURCES.memoryMb

  const storage =
    resources?.ephemeralStorageMb && resources.ephemeralStorageMb > 0
      ? resources.ephemeralStorageMb
      : FALLBACK_RESOURCES.ephemeralStorageMb

  return {
    requests: {
      cpu: `${cpu}m`,
      memory: `${memory}Mi`,
      "ephemeral-storage": `${storage}Mi`,
    },
    limits: {
      cpu: `${cpu}m`,
      memory: `${memory}Mi`,
      "ephemeral-storage": `${storage}Mi`,
    },
  }
}

/** Port the ClusterIP Service exposes (targetPort = container port). */
export const SERVICE_PORT = 80
