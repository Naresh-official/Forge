import z from "zod"
import { deploymentPlanSchema } from "./deployment"

/**
 * A project's live resource picture, as shown on the Resources tab.
 *
 * Allocation comes from the resource tier the user picked when the project
 * was created; usage, replica counts and autoscaler state are read live from
 * the Kubernetes API by the deployer.
 */

/** Where a project's deployment is served from. */
export type ProjectRuntime = "STATIC" | "KUBERNETES"

/** The per-pod resources the user selected for the deployment. */
export type ResourceAllocation = {
  cpuMillicores: number
  memoryMb: number
  ephemeralStorageMb: number
}

/**
 * Usage of one resource. `allocated` covers all replicas of the workload, so
 * `percent` answers "how much of what we granted is actually being used".
 */
export type ResourceUsage = {
  /** Current consumption: millicores for CPU, MiB for memory. */
  used: number
  /** Granted amount across the workload's replicas, same unit as `used`. */
  allocated: number
  /**
   * `used / allocated` as a whole percentage. Null when nothing is allocated
   * (e.g. the project is paused) or usage could not be read.
   */
  percent: number | null
}

/** Autoscaler state for a project deployed with an HPA. */
export type ProjectAutoscalingStatus = {
  /** Target average CPU utilisation, as a percentage of pod requests. */
  targetCpuUtilization: number
  /**
   * Average CPU utilisation the autoscaler last measured, or null when it
   * has no reading yet.
   */
  currentCpuUtilization: number | null
  minReplicas: number
  maxReplicas: number
  /** Short state label: "Steady", "Scaling up", "At maximum replicas", ... */
  status: string
  /** The autoscaler's own explanation for the current state. */
  message: string
}

export type ProjectResourcesResponse = {
  projectId: string
  /** Deployment the numbers belong to; null when the project has none. */
  deploymentId: string | null
  runtime: ProjectRuntime
  /** Resources the user selected for this deployment (per pod). */
  allocation: ResourceAllocation | null
  /** True when the deployment runs with a HorizontalPodAutoscaler. */
  autoscalingEnabled: boolean
  replicas: {
    desired: number
    ready: number
  }
  cpu: ResourceUsage
  memory: ResourceUsage
  /** Null when autoscaling is off (or the deployment has no workload). */
  autoscaling: ProjectAutoscalingStatus | null
  /**
   * False when the cluster's metrics API returned no readings (for example a
   * cluster without metrics-server). Allocation and replicas are still valid.
   */
  metricsAvailable: boolean
  /** Timestamp of the newest Kubernetes sample (ISO), null when none. */
  metricsTimestamp: string | null
  /** Non-fatal problems, e.g. the deployer being unreachable. */
  warnings: string[]
}

/**
 * The resource plan a project's deployments run with. Changing it updates the
 * project's current deployment and is inherited by every later deployment.
 */
export const updateProjectResourcesSchema = z.object({
  plan: deploymentPlanSchema,
  /** Run the workload with a HorizontalPodAutoscaler instead of a fixed count. */
  autoscalingEnabled: z.boolean(),
})

export type UpdateProjectResourcesInput = z.infer<
  typeof updateProjectResourcesSchema
>

/** What the settings save produced, including whether it reached the cluster. */
export type ProjectResourceSettings = {
  projectId: string
  /** Deployment the plan was written to (the project's newest one). */
  deploymentId: string
  runtime: ProjectRuntime
  allocation: ResourceAllocation
  autoscalingEnabled: boolean
  /** True when the running workload was resized in place. */
  applied: boolean
  warnings: string[]
}
