import prisma from "@/utils/db"
import { ApiError } from "@forge/types/apiResponses"
import { DEFAULT_DEPLOYMENT_RESOURCES } from "@forge/types"
import slugify from "slugify"
import { githubApp } from "../github/github.client"
import type { CreateRepositoryInput } from "@forge/types/deployment"
import { startBuildWrapper } from "@/gRPC/wrapper/builder.wrapper"

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
              ...DEFAULT_DEPLOYMENT_RESOURCES,
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
