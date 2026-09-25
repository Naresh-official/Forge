import { $Enums } from "@/generated/prisma/client"
import prisma from "@/utils/db"

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
