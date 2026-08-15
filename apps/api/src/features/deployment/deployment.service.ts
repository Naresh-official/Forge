import { builder } from "@/gRPC/clients/builder.client"
import prisma from "@/utils/db"
import { ApiError } from "@forge/types/apiResponses"
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

    const result = await startBuildWrapper({
        buildId: project.deployments[0]?.build?.id || "",
    })

    return project.deployments[0]?.build
}
