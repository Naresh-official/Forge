import { $Enums } from "@/generated/prisma/client"
import prisma from "@/utils/db"

export interface CompleteBuildInput {
    buildId: string
    status: "SUCCEEDED" | "FAILED" | "CANCELLED"

    // Container deployments
    imageUrl?: string
    imageTag?: string

    // Static deployments
    artifactBucket?: string
    artifactKey?: string
}

export async function completeBuildService(input: CompleteBuildInput) {
    const buildStatus = input.status as $Enums.BuildStatus
    const deploymentStatus = (
        input.status === "SUCCEEDED" ? "READY" : input.status
    ) as $Enums.DeploymentStatus

    return prisma.build.update({
        where: {
            id: input.buildId,
        },
        data: {
            status: buildStatus,
            completedAt: new Date(),
            deployment: {
                update: {
                    data: {
                        status: deploymentStatus,
                        completedAt: new Date(),
                        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
                        ...(input.imageTag ? { imageTag: input.imageTag } : {}),
                        ...(input.artifactBucket
                            ? { artifactBucket: input.artifactBucket }
                            : {}),
                        ...(input.artifactKey
                            ? { artifactKey: input.artifactKey }
                            : {}),
                    },
                },
            },
        },
        include: {
            deployment: true,
        },
    })
}
