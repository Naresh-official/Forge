import prisma from "@/utils/db"
import { isUuid } from "@/utils/uuid"
import { ApiError } from "@forge/types/apiResponses"
import { AUTOSCALING, DEPLOYMENT_PLANS } from "@forge/types/deployment"
import type {
  ProjectAutoscalingStatus,
  ProjectResourcesResponse,
  ProjectResourceSettings,
  ResourceUsage,
  UpdateProjectResourcesInput,
} from "@forge/types/resources"
import { isStaticFramework, normalizeFramework } from "@forge/frameworks"
import type { GetDeploymentMetricsResponse } from "@forge/contracts"
import {
  getDeploymentMetricsWrapper,
  updateDeploymentResourcesWrapper,
} from "@/gRPC/wrapper/deployer.wrapper"

/** Usage of one resource, with the percentage of the allocation consumed. */
function toUsage(used: number, allocated: number): ResourceUsage {
  return {
    used,
    allocated,
    percent: allocated > 0 ? Math.round((used / allocated) * 100) : null,
  }
}

/**
 * Autoscaler state for the UI. The HPA is the source of truth when the
 * deployer could read it; otherwise fall back to the bounds Forge configures
 * (the HPA may simply not have been created yet).
 */
function toAutoscaling(
  metrics: GetDeploymentMetricsResponse | null,
  autoscalingEnabled: boolean
): ProjectAutoscalingStatus | null {
  if (!autoscalingEnabled) {
    return null
  }

  const hpa = metrics?.autoscalingEnabled ? metrics : null

  return {
    targetCpuUtilization:
      hpa && hpa.targetCpuUtilization > 0
        ? hpa.targetCpuUtilization
        : AUTOSCALING.targetCpuUtilization,
    currentCpuUtilization:
      hpa && hpa.currentCpuUtilization >= 0 ? hpa.currentCpuUtilization : null,
    minReplicas:
      hpa && hpa.minReplicas > 0 ? hpa.minReplicas : AUTOSCALING.minReplicas,
    maxReplicas:
      hpa && hpa.maxReplicas > 0 ? hpa.maxReplicas : AUTOSCALING.maxReplicas,
    status: !metrics
      ? "Unknown"
      : !metrics.available
        ? "Unavailable"
        : metrics.scalingStatus || "Pending",
    message: !metrics
      ? "The cluster could not be reached, so the autoscaler state is unknown."
      : !metrics.available
        ? "There is no running workload to autoscale."
        : metrics.scalingMessage ||
          "The autoscaler has not reported a state yet.",
  }
}

async function findOwnedProjectOrThrow(projectId: string, userId: string) {
  if (!isUuid(projectId)) {
    throw new ApiError(404, "Project not found.")
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { githubRepository: { select: { framework: true } } },
  })

  if (!project) {
    throw new ApiError(404, "Project not found.")
  }

  return project
}

/**
 * A project's resource picture for the Resources tab.
 *
 * The user-selected allocation comes from the deployment's resource plan in
 * Postgres; usage, replicas and autoscaler state are read from the cluster by
 * the deployer. The Kubernetes read is best-effort: if it fails, the plan is
 * still reported with a warning instead of failing the whole page.
 */
export const getProjectResourcesService = async (
  projectId: string,
  userId: string
): Promise<ProjectResourcesResponse> => {
  const project = await findOwnedProjectOrThrow(projectId, userId)

  /*
   * The newest deployment that produced a container image is the one whose
   * namespace holds the running workload (same rule pause/resume uses). A
   * static build has no image, so it reports no Kubernetes workload at all.
   */
  const deployment = await prisma.deployment.findFirst({
    where: { projectId, imageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      resources: {
        select: {
          cpuMillicores: true,
          memoryMb: true,
          ephemeralStorageMb: true,
          autoscalingEnabled: true,
        },
      },
    },
  })

  const allocation = deployment?.resources
    ? {
        cpuMillicores: deployment.resources.cpuMillicores,
        memoryMb: deployment.resources.memoryMb,
        ephemeralStorageMb: deployment.resources.ephemeralStorageMb,
      }
    : null

  const warnings: string[] = []

  if (!deployment) {
    const framework = normalizeFramework(project.githubRepository?.framework)

    /*
     * No deployment yet. A static project will never touch Kubernetes, while
     * a container project is simply waiting for its first successful build.
     */
    if (!isStaticFramework(framework)) {
      warnings.push("This project has no deployment yet.")
    }

    return {
      projectId,
      deploymentId: null,
      runtime: isStaticFramework(framework) ? "STATIC" : "KUBERNETES",
      allocation,
      autoscalingEnabled: false,
      replicas: { desired: 0, ready: 0 },
      cpu: toUsage(0, 0),
      memory: toUsage(0, 0),
      autoscaling: null,
      metricsAvailable: false,
      metricsTimestamp: null,
      warnings,
    }
  }

  const autoscalingEnabled = deployment.resources?.autoscalingEnabled ?? false

  let metrics: GetDeploymentMetricsResponse | null = null

  try {
    metrics = await getDeploymentMetricsWrapper({
      projectId,
      deploymentId: deployment.id,
    })
  } catch (error) {
    console.error("Failed to read deployment metrics from the deployer:", error)
    warnings.push(
      "Live usage could not be read from the cluster — the deployer is unreachable."
    )
  }

  if (metrics && !metrics.available) {
    warnings.push(
      metrics.message ||
        "This deployment has no running Kubernetes workload to measure."
    )
  }

  if (metrics?.available && !metrics.metricsAvailable) {
    warnings.push(
      "Live usage is unavailable — the cluster's metrics API returned no readings."
    )
  }

  const replicas = metrics?.available
    ? { desired: metrics.replicasDesired, ready: metrics.replicasReady }
    : { desired: 0, ready: 0 }

  if (metrics?.available && replicas.desired === 0) {
    warnings.push("The workload is scaled to zero, so it uses no resources.")
  }

  return {
    projectId,
    deploymentId: deployment.id,
    runtime: "KUBERNETES",
    allocation,
    autoscalingEnabled,
    replicas,
    cpu: toUsage(
      metrics?.cpuUsageMillicores ?? 0,
      metrics?.cpuRequestMillicores ?? 0
    ),
    memory: toUsage(metrics?.memoryUsageMb ?? 0, metrics?.memoryRequestMb ?? 0),
    autoscaling: toAutoscaling(metrics, autoscalingEnabled),
    metricsAvailable: metrics?.metricsAvailable ?? false,
    metricsTimestamp: metrics?.metricsTimestamp || null,
    warnings,
  }
}

/**
 * Changes a project's resource plan (and autoscaling setting).
 *
 * The plan is written to the project's newest deployment, which is both the
 * deployment whose workload is serving traffic and the row later deployments
 * inherit their plan from — so one write covers both the running workload and
 * every future deployment. Container workloads are resized in place by the
 * deployer; static deployments have nothing to resize, so the plan only takes
 * effect on the next container deployment.
 *
 * A deployer failure does not fail the request: the plan is the user's
 * stated intent and is already persisted, so it is reported as a warning.
 */
export const updateProjectResourcesService = async (
  projectId: string,
  userId: string,
  input: UpdateProjectResourcesInput
): Promise<ProjectResourceSettings> => {
  const project = await findOwnedProjectOrThrow(projectId, userId)
  const plan = DEPLOYMENT_PLANS[input.plan]

  const deployment = await prisma.deployment.findFirst({
    where: { projectId: project.id },
    orderBy: { deploymentNumber: "desc" },
    select: { id: true, imageUrl: true },
  })

  if (!deployment) {
    throw new ApiError(
      400,
      "This project has no deployment yet — deploy it once before changing its resources."
    )
  }

  const allocation = {
    cpuMillicores: plan.cpuMillicores,
    memoryMb: plan.memoryMb,
    ephemeralStorageMb: plan.ephemeralStorageMb,
  }

  await prisma.deploymentResource.upsert({
    where: { deploymentId: deployment.id },
    create: {
      deploymentId: deployment.id,
      ...allocation,
      autoscalingEnabled: input.autoscalingEnabled,
    },
    update: {
      ...allocation,
      autoscalingEnabled: input.autoscalingEnabled,
    },
  })

  const runtime = deployment.imageUrl ? "KUBERNETES" : "STATIC"
  const warnings: string[] = []
  let applied = false

  if (runtime === "KUBERNETES") {
    try {
      const result = await updateDeploymentResourcesWrapper({
        projectId: project.id,
        deploymentId: deployment.id,
        ...allocation,
        autoscalingEnabled: input.autoscalingEnabled,
      })

      applied = result.updated

      if (result.skipped) {
        warnings.push(
          "No running Kubernetes workload was found — the new plan applies to the next deployment."
        )
      } else if (!result.rolloutReady) {
        warnings.push(
          "The new plan was applied, but the rollout did not become available in time."
        )
      }
    } catch (error) {
      console.error("Failed to apply the resource plan on the deployer:", error)
      warnings.push(
        "The plan was saved but could not be applied to the running workload — it will apply to the next deployment."
      )
    }
  } else {
    warnings.push(
      "Static deployments are served from object storage — the plan applies to the next container deployment."
    )
  }

  return {
    projectId: project.id,
    deploymentId: deployment.id,
    runtime,
    allocation,
    autoscalingEnabled: input.autoscalingEnabled,
    applied,
    warnings,
  }
}
