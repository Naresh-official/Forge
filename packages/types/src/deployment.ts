import z from "zod"
import type { ProjectFramework, ProjectStatus } from "./project"

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

/** POSIX-style variable name (e.g. DATABASE_URL). */
export const environmentVariableKeySchema = z
  .string()
  .trim()
  .min(1, "Key is required")
  .max(255)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "Key must start with a letter or underscore and contain only letters, digits and underscores"
  )

export const environmentVariableSchema = z.object({
  key: environmentVariableKeySchema,
  value: z.string().max(65_536),
})

export type EnvironmentVariableInput = z.infer<typeof environmentVariableSchema>

export const createRepositorySchema = z.object({
  repositoryId: z.int(),
  projectName: z.string().optional(),
  /** Variables preset while creating the project; encrypted before storage. */
  environmentVariables: z.array(environmentVariableSchema).max(100).optional(),
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
 * The deployment queued by a redeploy: a new build of the project's current
 * source (the latest deployment's commit).
 */
export type RedeployProjectResponse = {
  deploymentId: string
  buildId: string
  deploymentNumber: number
}

/**
 * Which plane a deployment's output lives on. Static deployments are served
 * from object storage; container deployments run on Kubernetes.
 */
export type DeploymentRuntime = "KUBERNETES" | "STATIC"

/** One deployment in the cross-project deployments list. */
export type DeploymentListItem = {
  id: string
  deploymentNumber: number
  status: DeploymentStatus
  branch: string
  commitSha: string
  commitMessage: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  runtime: DeploymentRuntime
  project: {
    id: string
    name: string
  }
}

export type ListDeploymentsResponse = DeploymentListItem[]

/** The project a deployment belongs to, as the detail view shows it. */
export type DeploymentDetailProject = {
  id: string
  name: string
  slug: string
  status: ProjectStatus
  repoFullName: string | null
  framework: ProjectFramework | null
}

/** Everything the deployment detail page renders. */
export type DeploymentDetailResponse = {
  id: string
  deploymentNumber: number
  status: DeploymentStatus
  branch: string
  commitSha: string
  commitMessage: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  runtime: DeploymentRuntime
  /** Container image tag (container deployments only). */
  imageTag: string | null
  project: DeploymentDetailProject
  build: {
    id: string
    status: BuildStatus
    startedAt: Date | null
    completedAt: Date | null
  } | null
  resources: {
    cpuMillicores: number
    memoryMb: number
    ephemeralStorageMb: number
    autoscalingEnabled: boolean
  } | null
  /** Who started the deployment (the project owner, in practice). */
  createdBy: {
    name: string | null
    email: string
  } | null
}

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
