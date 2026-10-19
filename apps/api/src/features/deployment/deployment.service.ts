import { $Enums } from "@/generated/prisma/client"
import prisma from "@/utils/db"
import { ApiError } from "@forge/types/apiResponses"
import { DEPLOYMENT_PLANS } from "@forge/types"
import slugify from "slugify"
import { githubApp } from "../github/github.client"
import type { CreateRepositoryInput } from "@forge/types/deployment"
import { startBuildWrapper } from "@/gRPC/wrapper/builder.wrapper"
import { encryptEnvValue } from "@/utils/encryption"

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
