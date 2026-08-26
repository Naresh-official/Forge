import { githubApp } from "@/features/github/github.client"
import prisma from "@/utils/db"
import { completeBuildService } from "@/features/builds/build.service"
import type {
    BuildStartedRequest,
    BuildStartedResponse,
    BuildCompletedRequest,
    BuildCompletedResponse,
} from "@forge/contracts"
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js"

export const apiService = {
    async buildStarted(
        call: ServerUnaryCall<BuildStartedRequest, BuildStartedResponse>,
        callback: sendUnaryData<BuildStartedResponse>
    ) {
        try {
            const buildId = call.request.buildId
            if (!buildId) {
                throw new Error("Build ID is required")
            }
            const build = await prisma.build.update({
                where: {
                    id: buildId,
                },
                include: {
                    deployment: {
                        include: {
                            project: {
                                include: {
                                    githubRepository: true,
                                },
                            },
                        },
                    },
                },
                data: {
                    status: "BUILDING",
                    deployment: {
                        update: {
                            data: {
                                status: "BUILDING",
                            },
                        },
                    },
                },
            })

            if (!build) {
                throw new Error("Build not found")
            }
            if (!build.deployment.project.githubRepository) {
                throw new Error("GitHub repository not found")
            }
            if (!build.deployment.project.githubRepository.installationId) {
                throw new Error("GitHub installation not found")
            }
            const { token } = (await githubApp.octokit.auth({
                type: "installation",
                installationId:
                    build.deployment.project.githubRepository.installationId,
            })) as { token: string }

            if (!token) {
                throw new Error("GitHub installation token not found")
            }
            callback(null, {
                accessToken: token,
                repoFullName:
                    build.deployment.project.githubRepository.fullName,
                projectId: build.deployment.project.id,
                deploymentId: build.deployment.id,
                branch: build.deployment.branch,
                commitSha: build.deployment.commitSha,
                buildId: build.id,
            })
        } catch (error) {
            callback(error as Error, null)
            return
        }
    },

    async buildCompleted(
        call: ServerUnaryCall<BuildCompletedRequest, BuildCompletedResponse>,
        callback: sendUnaryData<BuildCompletedResponse>
    ) {
        try {
            const request = call.request

            if (!request.buildId) {
                throw new Error("Build ID is required")
            }

            if (
                !["SUCCEEDED", "FAILED", "CANCELLED"].includes(
                    request.status
                )
            ) {
                throw new Error(`Invalid build status: ${request.status}`)
            }

            await completeBuildService({
                buildId: request.buildId,
                status: request.status as "SUCCEEDED" | "FAILED" | "CANCELLED",
                imageUrl: request.imageUrl || undefined,
                imageTag: request.imageTag || undefined,
                artifactBucket: request.artifactBucket || undefined,
                artifactKey: request.artifactKey || undefined,
            })

            callback(null, {
                success: true,
                message: "Build completed",
            })
        } catch (error) {
            callback(error as Error, null)
            return
        }
    },
}
