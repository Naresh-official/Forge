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

  /*
   * A succeeded build does NOT make the deployment READY — the deployer
   * reports READY/FAILED via DeployerApiService.DeploymentCompleted once the
   * Kubernetes rollout finishes. Failed/cancelled builds fail the deployment.
   */
  const deploymentStatus = (
    input.status === "SUCCEEDED" ? "BUILDING" : input.status
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
            ...(input.artifactKey ? { artifactKey: input.artifactKey } : {}),
          },
        },
      },
    },
    include: {
      deployment: true,
    },
  })
}
