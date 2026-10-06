import z from "zod"

export const deploymentPlanSchema = z.enum(["basic", "standard", "pro"])

export type DeploymentPlanId = z.infer<typeof deploymentPlanSchema>

export interface DeploymentPlan {
  id: DeploymentPlanId
  label: string
  /** CPU request/limit in millicores. */
  cpuMillicores: number
  /** Memory request/limit in MiB. */
  memoryMb: number
  /** Ephemeral storage request/limit in MiB. */
  ephemeralStorageMb: number
}

/**
 * Selectable resource tiers. Each tier doubles the previous one.
 * Requests equal limits (Kubernetes Guaranteed QoS).
 */
export const DEPLOYMENT_PLANS: Record<DeploymentPlanId, DeploymentPlan> = {
  basic: {
    id: "basic",
    label: "Basic",
    cpuMillicores: 500,
    memoryMb: 512,
    ephemeralStorageMb: 2048,
  },
  standard: {
    id: "standard",
    label: "Standard",
    cpuMillicores: 1000,
    memoryMb: 1024,
    ephemeralStorageMb: 4096,
  },
  pro: {
    id: "pro",
    label: "Pro",
    cpuMillicores: 2000,
    memoryMb: 2048,
    ephemeralStorageMb: 8192,
  },
}

export const deploymentPlanIds: DeploymentPlanId[] = [
  "basic",
  "standard",
  "pro",
]

/**
 * Bounds the deployer's HorizontalPodAutoscaler applies when a project
 * opts into autoscaling instead of a fixed resource tier.
 */
export const AUTOSCALING = {
  minReplicas: 1,
  maxReplicas: 5,
  /** Target average CPU utilisation, as a percentage of requests. */
  targetCpuUtilization: 80,
} as const

export const createRepositorySchema = z.object({
  repositoryId: z.int(),
  projectName: z.string().optional(),
  /** Resource tier for non-static (containerized) projects. */
  plan: deploymentPlanSchema.optional(),
  /**
   * When true, the service is deployed with an HPA (max {@link AUTOSCALING.maxReplicas}
   * replicas, target {@link AUTOSCALING.targetCpuUtilization}% CPU) instead of a
   * fixed replica count. Requests still come from `plan` (Basic by default).
   */
  autoscaling: z.boolean().optional(),
})

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>

/**
 * Default resources assigned to every deployment (the Basic plan).
 */
export const DEFAULT_DEPLOYMENT_RESOURCES = {
  cpuMillicores: DEPLOYMENT_PLANS.basic.cpuMillicores,
  memoryMb: DEPLOYMENT_PLANS.basic.memoryMb,
  ephemeralStorageMb: DEPLOYMENT_PLANS.basic.ephemeralStorageMb,
  autoscalingEnabled: false,
} as const

export type DeploymentStatus =
  "QUEUED" | "BUILDING" | "DEPLOYING" | "READY" | "FAILED" | "CANCELLED"

export type BuildStatus =
  "QUEUED" | "BUILDING" | "SUCCEEDED" | "FAILED" | "CANCELLED"

/**
 * The build returned when a deployment is started. Mirrors the `Build`
 * Prisma model, which is what `POST /deployments/new` responds with.
 */
export type StartDeploymentResponse = {
  id: string
  deploymentId: string
  status: BuildStatus
  logsPath: string | null
  createdAt: string
  startedAt: string | null
  completedAt: string | null
}
