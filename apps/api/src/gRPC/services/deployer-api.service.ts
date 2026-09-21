import prisma from "@/utils/db"
import type {
  DeploymentStartedRequest,
  DeploymentStartedResponse,
} from "@forge/contracts"
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js"

export const deployerApiService = {
  async deploymentStarted(
    call: ServerUnaryCall<DeploymentStartedRequest, DeploymentStartedResponse>,
    callback: sendUnaryData<DeploymentStartedResponse>
  ) {
    try {
      const { deploymentId } = call.request
      if (!deploymentId) {
        throw new Error("Deployment ID is required")
      }

      await prisma.deployment.update({
        where: {
          id: deploymentId,
        },
        data: {
          status: "DEPLOYING",
          startedAt: new Date(),
        },
      })

      callback(null, {
        success: true,
        message: "Deployment status updated to DEPLOYING",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },
}
