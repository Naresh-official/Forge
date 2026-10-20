import { $Enums } from "@/generated/prisma/client"
import prisma from "@/utils/db"
import { ApiError } from "@forge/types/apiResponses"
import { DEPLOYMENT_PLANS } from "@forge/types"
import slugify from "slugify"
import { githubApp } from "../github/github.client"
import type {
  CreateRepositoryInput,
  DeploymentRuntime,
} from "@forge/types/deployment"
import { startBuildWrapper } from "@/gRPC/wrapper/builder.wrapper"
import { encryptEnvValue } from "@/utils/encryption"
import { isUuid } from "@/utils/uuid"
import {
  isStaticFramework,
  normalizeFramework,
  type Framework,
} from "@forge/frameworks"

/** How many deployments the cross-project list returns. */
const MAX_LISTED_DEPLOYMENTS = 50

export const deployRepositoryService = async (
  input: CreateRepositoryInput,
  userId: string
) => {
  const installation = await prisma.gitHubInstallation.findFirst({
    where: {
      userId,
    },
  })

  if (!installation) {
    throw new ApiError(404, "Installation not found.")
  }

  const repository = await prisma.gitHubRepository.findUnique({
    where: {
      installationId_id: {
        installationId: installation.id,
        id: input.repositoryId,
      },
    },
  })

  if (!repository) {
    throw new ApiError(404, "Repository not found.")
  }

  if (repository.projectId) {
    throw new ApiError(409, "Project already exists.")
  }

  const octakitApp = await githubApp.getInstallationOctokit(installation.id)

  const { data: commits } = await octakitApp.rest.repos.listCommits({
    owner: installation.accountLogin,
    repo: repository.fullName.split("/")[1]!,
    per_page: 1,
  })

  const latestCommit = commits[0]

  if (!latestCommit) {
    throw new ApiError(404, "No commits found in the repository.")
  }

  const plan = DEPLOYMENT_PLANS[input.plan ?? "basic"]

  const environmentVariables = input.environmentVariables ?? []
  const seenKeys = new Set<string>()

  for (const variable of environmentVariables) {
    if (seenKeys.has(variable.key)) {
      throw new ApiError(
        400,
        `Duplicate environment variable "${variable.key}".`
      )
    }
    seenKeys.add(variable.key)
  }

  /*
   * Encrypt before writing anything, so a missing/invalid
   * ENV_ENCRYPTION_SECRET fails the request without leaving a project
   * (and its first deployment) behind.
   */
  const encryptedEnvironmentVariables = environmentVariables.map(
    (variable) => ({
      key: variable.key,
      valueEncrypted: encryptEnvValue(variable.value),
      isSecret: true,
    })
  )

  const project = await prisma.project.create({
    data: {
      userId,
      name: input.projectName || repository.fullName,
      slug: slugify(input.projectName || repository.fullName, {
        lower: true,
        strict: true,
        trim: true,
      }),
      githubRepository: {
        connect: {
          id: repository.id,
        },
      },
      ...(encryptedEnvironmentVariables.length > 0
        ? {
            environmentVariables: {
              create: encryptedEnvironmentVariables,
            },
          }
        : {}),
      deployments: {
        create: {
          deploymentNumber: 1,
          commitSha: latestCommit.sha,
          commitMessage: latestCommit.commit.message,
          branch: repository.defaultBranch,
          status: "QUEUED",
          createdByUserId: userId,
          resources: {
            create: {
              cpuMillicores: plan.cpuMillicores,
              memoryMb: plan.memoryMb,
              ephemeralStorageMb: plan.ephemeralStorageMb,
              autoscalingEnabled: input.autoscaling ?? false,
            },
          },
          build: {
            create: {
              status: "QUEUED",
            },
          },
        },
      },
    },
    include: {
      githubRepository: true,
      deployments: {
        include: {
          build: true,
        },
      },
    },
  })

  const build = project.deployments[0]?.build

  if (!build) {
    throw new Error("Deployment was created without a build")
  }

  try {
    await startBuildWrapper({
      buildId: build.id,
    })
  } catch (error) {
    /*
     * The builder never received the job, so no BuildStarted will ever
     * arrive — fail the build AND deployment here instead of leaving
     * them stuck in QUEUED forever.
     */
    console.error("Failed to forward build to builder:", error)

    await prisma.build.update({
      where: { id: build.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        deployment: {
          update: {
            data: {
              status: "FAILED",
              completedAt: new Date(),
            },
          },
        },
      },
    })

    throw new ApiError(
      502,
      "Failed to queue the build — the builder is unreachable."
    )
  }

  return build
}

/**
 * Which plane a deployment's output lives on. A stored artifact means a
 * static build, an image means a container build; a deployment that produced
 * neither inherits the answer from the project's detected framework.
 */
function runtimeFor(
  source: { imageUrl: string | null; artifactKey: string | null },
  framework: Framework
): DeploymentRuntime {
  if (source.artifactKey !== null) {
    return "STATIC"
  }

  if (source.imageUrl !== null) {
    return "KUBERNETES"
  }

  return isStaticFramework(framework) ? "STATIC" : "KUBERNETES"
}

/**
 * Every deployment of every project the caller owns, newest first. Powers the
 * cross-project deployments page.
 */
export const listDeploymentsService = async (userId: string) => {
  const deployments = await prisma.deployment.findMany({
    where: { project: { userId } },
    orderBy: { createdAt: "desc" },
    take: MAX_LISTED_DEPLOYMENTS,
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
      imageUrl: true,
      artifactKey: true,
      project: {
        select: {
          id: true,
          name: true,
          githubRepository: { select: { framework: true } },
        },
      },
    },
  })

  return deployments.map((deployment) => ({
    id: deployment.id,
    deploymentNumber: deployment.deploymentNumber,
    status: deployment.status,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    createdAt: deployment.createdAt,
    startedAt: deployment.startedAt,
    completedAt: deployment.completedAt,
    runtime: runtimeFor(
      deployment,
      normalizeFramework(deployment.project.githubRepository?.framework)
    ),
    project: { id: deployment.project.id, name: deployment.project.name },
  }))
}

/**
 * One deployment, together with the project, build and resource plan the
 * detail page renders. Ownership is checked on the project — a deployment the
 * caller does not own reads as missing so ids cannot be probed.
 */
export const getDeploymentService = async (
  deploymentId: string,
  userId: string
) => {
  if (!isUuid(deploymentId)) {
    throw new ApiError(404, "Deployment not found.")
  }

  const deployment = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: { userId } },
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
      imageUrl: true,
      imageTag: true,
      artifactKey: true,
      project: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          githubRepository: { select: { fullName: true, framework: true } },
        },
      },
      build: {
        select: {
          id: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      },
      resources: {
        select: {
          cpuMillicores: true,
          memoryMb: true,
          ephemeralStorageMb: true,
          autoscalingEnabled: true,
        },
      },
      createdByUser: { select: { name: true, email: true } },
    },
  })

  if (!deployment) {
    throw new ApiError(404, "Deployment not found.")
  }

  return {
    id: deployment.id,
    deploymentNumber: deployment.deploymentNumber,
    status: deployment.status,
    branch: deployment.branch,
    commitSha: deployment.commitSha,
    commitMessage: deployment.commitMessage,
    createdAt: deployment.createdAt,
    startedAt: deployment.startedAt,
    completedAt: deployment.completedAt,
    runtime: runtimeFor(
      deployment,
      normalizeFramework(deployment.project.githubRepository?.framework)
    ),
    imageTag: deployment.imageTag,
    project: {
      id: deployment.project.id,
      name: deployment.project.name,
      slug: deployment.project.slug,
      status: deployment.project.status,
      repoFullName: deployment.project.githubRepository?.fullName ?? null,
      framework: deployment.project.githubRepository?.framework ?? null,
    },
    build: deployment.build,
    resources: deployment.resources,
    createdBy: deployment.createdByUser,
  }
}

type RedeploySource = {
  projectId: string
  deploymentNumber: number
  commitSha: string
  commitMessage: string | null
  branch: string
  resources: {
    cpuMillicores: number
    memoryMb: number
    ephemeralStorageMb: number
    autoscalingEnabled: boolean
  } | null
}

/**
 * Creates the next deployment for a project from an existing one's source and
 * plan, then asks the builder to build it.
 */
async function queueRedeploy(source: RedeploySource, userId: string) {
  let created: {
    deploymentId: string
    deploymentNumber: number
    buildId: string
  }

  try {
    created = await prisma.$transaction(async (tx) => {
      const deployment = await tx.deployment.create({
        data: {
          projectId: source.projectId,
          deploymentNumber: source.deploymentNumber + 1,
          commitSha: source.commitSha,
          commitMessage: source.commitMessage,
          branch: source.branch,
          status: "QUEUED",
          createdByUserId: userId,
          ...(source.resources
            ? {
                resources: {
                  create: {
                    cpuMillicores: source.resources.cpuMillicores,
                    memoryMb: source.resources.memoryMb,
                    ephemeralStorageMb: source.resources.ephemeralStorageMb,
                    autoscalingEnabled: source.resources.autoscalingEnabled,
                  },
                },
              }
            : {}),
        },
        select: { id: true, deploymentNumber: true },
      })

      const build = await tx.build.create({
        data: { deploymentId: deployment.id, status: "QUEUED" },
        select: { id: true },
      })

      return {
        deploymentId: deployment.id,
        deploymentNumber: deployment.deploymentNumber,
        buildId: build.id,
      }
    })
  } catch (error) {
    /*
     * Two deploys racing each other would both claim the same deployment
     * number, which the unique constraint rejects. Report that as a conflict
     * instead of a server error so the UI can simply ask to retry.
     */
    if ((error as { code?: string }).code === "P2002") {
      throw new ApiError(
        409,
        "Another deployment was started at the same time — try again."
      )
    }

    throw error
  }

  try {
    await startBuildWrapper({ buildId: created.buildId })
  } catch (error) {
    console.error("Failed to forward redeploy to builder:", error)

    /*
     * No BuildStarted will arrive, so fail both rows instead of leaving them
     * stuck in QUEUED (same reasoning as the initial deploy path).
     */
    await prisma.$transaction([
      prisma.build.update({
        where: { id: created.buildId },
        data: { status: "FAILED", completedAt: new Date() },
      }),
      prisma.deployment.update({
        where: { id: created.deploymentId },
        data: { status: "FAILED", completedAt: new Date() },
      }),
    ])

    throw new ApiError(
      502,
      "Failed to queue the build — the builder is unreachable."
    )
  }

  return created
}

/**
 * Queues a new deployment of the project's current source: the latest
 * deployment's commit is rebuilt under the next deployment number, reusing
 * its resource plan. This is the Deploy action on the deployments page.
 *
 * A project with no deployment yet has no known commit, so its first
 * deployment must come from the create-project flow.
 */
export const redeployProjectService = async (
  projectId: string,
  userId: string
) => {
  if (!isUuid(projectId)) {
    throw new ApiError(404, "Project not found.")
  }

  const previous = await prisma.deployment.findFirst({
    where: { projectId, project: { userId } },
    orderBy: { deploymentNumber: "desc" },
    include: { resources: true },
  })

  if (!previous) {
    throw new ApiError(400, "This project has no deployment to redeploy yet.")
  }

  return queueRedeploy(previous, userId)
}

/**
 * Rebuilds one specific deployment's commit — the Redeploy action on a
 * deployment's detail page. Unlike a project-wide redeploy, this works from
 * an older deployment too, so it doubles as a way to re-release a commit.
 */
export const redeployDeploymentService = async (
  deploymentId: string,
  userId: string
) => {
  if (!isUuid(deploymentId)) {
    throw new ApiError(404, "Deployment not found.")
  }

  const source = await prisma.deployment.findFirst({
    where: { id: deploymentId, project: { userId } },
    include: { resources: true },
  })

  if (!source) {
    throw new ApiError(404, "Deployment not found.")
  }

  return queueRedeploy(source, userId)
}

export interface CompleteDeploymentInput {
  deploymentId: string
  status: "READY" | "FAILED"
  message?: string
  imageUrl?: string
}

export async function completeDeploymentService(
  input: CompleteDeploymentInput
) {
  /*
   * Only the deployment lifecycle is finalized here. Build.status is NOT
   * touched: builds have their own lifecycle (QUEUED → BUILDING →
   * SUCCEEDED/FAILED) managed by completeBuildService when the builder
   * reports the build result — a build that succeeded stays SUCCEEDED even
   * if the subsequent Kubernetes rollout fails.
   */
  return prisma.deployment.update({
    where: { id: input.deploymentId },
    data: {
      status: input.status as $Enums.DeploymentStatus,
      completedAt: new Date(),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
    },
  })
}
