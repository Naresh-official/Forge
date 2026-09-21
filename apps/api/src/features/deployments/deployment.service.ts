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
  const deployment = await prisma.deployment.findUnique({
    where: { id: input.deploymentId },
    include: { build: true },
  })

  if (!deployment) {
    throw new Error(`Deployment ${input.deploymentId} not found`)
  }

  return prisma.deployment.update({
    where: { id: input.deploymentId },
    data: {
      status: input.status as $Enums.DeploymentStatus,
      completedAt: new Date(),
      ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      ...(deployment.build
        ? {
            build: {
              update: {
                data: {
                  // Keep the build lifecycle in sync with the deployment outcome
                  status: input.status === "READY" ? "SUCCEEDED" : "FAILED",
                  completedAt: new Date(),
                },
              },
            },
          }
        : {}),
    },
  })
}
