import prisma from "@/utils/db"
import { isUuid } from "@/utils/uuid"
import { ApiError } from "@forge/types/apiResponses"
import type { DeploymentStatus, ProjectStatus } from "@forge/types"
import { apiConfig } from "@forge/config"
import { deleteObjectsByPrefix } from "@forge/storage"
import { deleteImagesByTagPrefix } from "@forge/registry"
import {
  deleteDeploymentsWrapper,
  scaleDeploymentWrapper,
} from "@/gRPC/wrapper/deployer.wrapper"

export const listAllProjectsService = async (userId: string) => {
  const projects = await prisma.project.findMany({
    where: {
      userId,
    },
    include: {
      deployments: {
        take: 1,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          branch: true,
          status: true,
        },
      },
      githubRepository: {
        select: {
          fullName: true,
          defaultBranch: true,
          framework: true,
        },
      },
    },
  })
  const formatedProjects = projects.map((project) => {
    const deployment = project.deployments[0]
    const githubRepository = project.githubRepository || null
    return {
      ...project,
      // The framework lives on the repository now — surface it at the
      // project level for the existing UI.
      framework: githubRepository?.framework ?? null,
      deployments: {
        branch: deployment?.branch as string,
        status: deployment?.status as DeploymentStatus,
      },
      githubRepository,
    }
  })
  return formatedProjects
}

/**
 * Lightweight project list — just the id and name, for places that only
 * need to link to a project (e.g. the sidebar).
 */
export const listProjectNamesService = async (userId: string) => {
  return prisma.project.findMany({
    where: {
      userId,
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })
}

/**
 * Every deployment of a project, newest first. Used by the logs page to
 * resolve real deployment IDs instead of the mock identifiers the UI used
 * to pass around.
 *
 * Ownership is checked on the project — a project the caller does not own is
 * reported as missing rather than forbidden, so IDs cannot be probed.
 */
export const listProjectDeploymentsService = async (
  projectId: string,
  userId: string
) => {
  // A malformed id would reach Postgres and throw before we could 404.
  if (!isUuid(projectId)) {
    throw new ApiError(404, "Project not found.")
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  })

  if (!project) {
    throw new ApiError(404, "Project not found.")
  }

  return prisma.deployment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      deploymentNumber: true,
      status: true,
      branch: true,
      commitSha: true,
      commitMessage: true,
      createdAt: true,
      startedAt: true,
      completedAt: true,
    },
  })
}

/** Ownership-scoped lookup shared by the settings mutations. */
async function findOwnedProjectOrThrow(projectId: string, userId: string) {
  if (!isUuid(projectId)) {
    throw new ApiError(404, "Project not found.")
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
  })

  if (!project) {
    throw new ApiError(404, "Project not found.")
  }

  return project
}

export const renameProjectService = async (
  projectId: string,
  userId: string,
  name: string
) => {
  await findOwnedProjectOrThrow(projectId, userId)

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { name },
  })

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status as ProjectStatus,
  }
}

/**
 * Pause or resume a project.
 *
 * Updates durable state and then asks the deployer to scale the running
 * workload: 0 replicas when paused, 1 when active (the HPA, when enabled,
 * takes over from there). The status change is rolled back if the deployer
 * call fails so the database never claims a state the cluster is not in.
 * Static projects have no Kubernetes workload, so only the DB changes.
 */
export const setProjectStatusService = async (
  projectId: string,
  userId: string,
  status: ProjectStatus
) => {
  const existing = await findOwnedProjectOrThrow(projectId, userId)

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { status },
  })

  // The currently-serving deployment is the newest READY one with an image.
  const deployment = await prisma.deployment.findFirst({
    where: { projectId, status: "READY", imageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { resources: true },
  })

  if (deployment) {
    try {
      await scaleDeploymentWrapper({
        projectId,
        deploymentId: deployment.id,
        replicas: status === "PAUSED" ? 0 : 1,
        autoscalingEnabled: deployment.resources?.autoscalingEnabled ?? false,
      })
    } catch (error) {
      console.error("Failed to scale project workload:", error)

      await prisma.project.update({
        where: { id: projectId },
        data: { status: existing.status },
      })

      throw new ApiError(
        502,
        "Failed to update the project's running workload."
      )
    }
  }

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status as ProjectStatus,
  }
}

/**
 * Best-effort cleanup of the external resources a project created.
 *
 * Every step runs independently so one failure (e.g. an IAM policy that
 * forbids ECR deletion) never prevents the others. Failures are logged and
 * returned as human-readable warnings rather than thrown, because the
 * database row is still removed — a project whose images are left behind
 * should not become permanently undeletable. All steps are idempotent.
 */
async function cleanupProjectResources(
  projectId: string,
  deploymentIds: string[]
): Promise<string[]> {
  const warnings: string[] = []
  const registry = apiConfig.dockerRegistry
  const storage = apiConfig.storage
  const credentials = {
    accessKeyId: storage.accessKeyId,
    secretAccessKey: storage.secretAccessKey,
  }

  // Kubernetes namespaces (one per deployment) — stop the running workload.
  if (deploymentIds.length > 0) {
    try {
      await deleteDeploymentsWrapper({ projectId, deploymentIds })
    } catch (error) {
      console.error("Failed to delete Kubernetes namespaces:", error)
      warnings.push("Kubernetes workloads could not be deleted.")
    }
  }

  // Container images, tagged "<projectId>.<deploymentId>.<repo>".
  if (registry.repository && registry.accessKeyId) {
    try {
      await deleteImagesByTagPrefix(
        registry,
        registry.repository,
        `${projectId}.`
      )
    } catch (error) {
      console.error("Failed to delete container images:", error)
      warnings.push("Container images could not be deleted.")
    }
  }

  // Static build artifacts, stored under "<projectId>/...".
  if (storage.bucket && storage.accessKeyId) {
    try {
      await deleteObjectsByPrefix(
        { ...credentials, region: storage.region, bucket: storage.bucket },
        `${projectId}/`
      )
    } catch (error) {
      console.error("Failed to delete build artifacts:", error)
      warnings.push("Static build artifacts could not be deleted.")
    }
  }

  // Persisted build/runtime logs, stored under "<projectId>/...".
  if (apiConfig.logs.bucket && storage.accessKeyId) {
    try {
      await deleteObjectsByPrefix(
        {
          ...credentials,
          region: apiConfig.logs.region,
          bucket: apiConfig.logs.bucket,
        },
        `${projectId}/`
      )
    } catch (error) {
      console.error("Failed to delete persisted logs:", error)
      warnings.push("Persisted logs could not be deleted.")
    }
  }

  return warnings
}

/**
 * Deletes a project and cleans up the resources it created: Kubernetes
 * namespaces, container images and object-storage objects. Cleanup is
 * best-effort (see {@link cleanupProjectResources}); the project row is
 * always removed and any cleanup failures are reported back to the caller.
 */
export const deleteProjectService = async (
  projectId: string,
  userId: string
) => {
  const project = await findOwnedProjectOrThrow(projectId, userId)

  const deployments = await prisma.deployment.findMany({
    where: { projectId: project.id },
    select: { id: true },
  })

  const cleanupWarnings = await cleanupProjectResources(
    project.id,
    deployments.map((deployment) => deployment.id)
  )

  // Deployments, domains, env vars and resources cascade. The linked
  // GitHub repository is unlinked (onDelete: SetNull), not deleted.
  await prisma.project.delete({ where: { id: project.id } })

  return { id: project.id, cleanupWarnings }
}
