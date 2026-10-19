import type {
  DeploymentStartedRequest,
  DeploymentStartedResponse,
  DeploymentCompletedRequest,
  DeploymentCompletedResponse,
} from "@forge/contracts"
import type { sendUnaryData, ServerUnaryCall } from "@grpc/grpc-js"
import prisma from "@/utils/db"
import { completeDeploymentService } from "@/features/deployment/deployment.service"
import { decryptEnvVariables } from "@/utils/encryption"

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

      const deployment = await prisma.deployment.update({
        where: {
          id: deploymentId,
        },
        data: {
          status: "DEPLOYING",
          startedAt: new Date(),
        },
        include: {
          project: {
            include: {
              environmentVariables: true,
            },
          },
        },
      })

      /*
       * Static deployments never reach Kubernetes, so nothing is sent for
       * them. Container deployments get their variables injected at runtime;
       * the deployer turns them into a Kubernetes Secret in the deployment
       * namespace. Decryption happens here because the API is the only
       * service holding ENV_ENCRYPTION_SECRET.
       */
      const { values: environmentVariables, failedKeys } = deployment.imageUrl
        ? decryptEnvVariables(deployment.project.environmentVariables)
        : { values: {}, failedKeys: [] }

      if (failedKeys.length > 0) {
        // Unreadable rows are skipped so the rest of the configuration still
        // reaches the workload; re-entering the value repairs them.
        console.error(
          `[deployment ${deploymentId}] Could not decrypt environment variable(s): ${failedKeys.join(
            ", "
          )} — not sent to the deployer.`
        )
      }

      callback(null, {
        success: true,
        message: "Deployment status updated to DEPLOYING",
        environmentVariables,
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
