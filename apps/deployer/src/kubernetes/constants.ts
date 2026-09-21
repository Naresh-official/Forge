/** Labels applied to every Kubernetes resource Forge creates. */
export const FORGE_MANAGED_BY_LABELS = {
  "app.kubernetes.io/managed-by": "forge",
} as const

/**
 * Fixed resource requests/limits for deployed containers.
 * - CPU:    500 m request / 1000 m limit
 * - Memory: 512 Mi request / 2048 Mi limit
 */
export const CONTAINER_RESOURCES = {
  requests: {
    cpu: "500m",
    memory: "512Mi",
  },
  limits: {
    cpu: "1000m",
    memory: "2048Mi",
  },
} as const

/** Port the ClusterIP Service exposes (targetPort = container port). */
export const SERVICE_PORT = 80
