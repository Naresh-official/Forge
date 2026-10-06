import type { ContainerResources } from "./types"

/** Labels applied to every Kubernetes resource Forge creates. */
export const FORGE_MANAGED_BY_LABELS = {
  "app.kubernetes.io/managed-by": "forge",
} as const

/**
 * Forge identity labels attached to pod templates. Fluent Bit's kubernetes
 * filter enriches every runtime log record with these, so logs are routed by
 * explicit project/deployment labels — never by parsing pod names (which are
 * truncated/unreliable as identifiers).
 */
export const FORGE_IDENTITY_LABELS = {
  "forge.dev/project-id": "",
  "forge.dev/deployment-id": "",
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

/**
 * Horizontal Pod Autoscaler bounds for autoscaling projects. The service
 * runs at least one replica (so it can resume from a cold start) and
 * bursts up to five when average CPU utilisation crosses the target.
 */
export const HPA_MIN_REPLICAS = 1
export const HPA_MAX_REPLICAS = 5
/** Target average CPU utilisation as a percentage of pod requests. */
export const HPA_TARGET_CPU_UTILIZATION = 80
