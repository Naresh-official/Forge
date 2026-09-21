import type {
  DeploymentStartedRequest,
  DeploymentStartedResponse,
  DeploymentCompletedRequest,
  DeploymentCompletedResponse,
} from "@forge/contracts"
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js"
import prisma from "@/utils/db"
import { completeDeploymentService } from "@/features/deployments/deployment.service"

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

  async deploymentCompleted(
    call: ServerUnaryCall<
      DeploymentCompletedRequest,
      DeploymentCompletedResponse
    >,
    callback: sendUnaryData<DeploymentCompletedResponse>
  ) {
    try {
      const request = call.request

      if (!request.deploymentId) {
        throw new Error("Deployment ID is required")
      }

      if (!["READY", "FAILED"].includes(request.status)) {
        throw new Error(`Invalid deployment status: ${request.status}`)
      }

      await completeDeploymentService({
        deploymentId: request.deploymentId,
        status: request.status as "READY" | "FAILED",
        message: request.message || undefined,
        imageUrl: request.imageUrl || undefined,
      })

      callback(null, {
        success: true,
        message: `Deployment status updated to ${request.status}`,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },
}
