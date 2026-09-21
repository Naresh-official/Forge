import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"
import type { DeployRequest, DeployResponse } from "@forge/contracts"
import { deployerQueue } from "@/queue/queue"

export const deployerService = {
  async deploy(
    call: ServerUnaryCall<DeployRequest, DeployResponse>,
    callback: sendUnaryData<DeployResponse>
  ) {
    try {
      const request = call.request
      console.log("Received deploy request", request)
      await deployerQueue.add("deploy", {
        deploymentId: request.deploymentId,
        projectId: request.projectId,
        buildId: request.buildId,
        imageUrl: request.imageUrl,
        imageTag: request.imageTag,
        artifactBucket: request.artifactBucket,
        artifactKey: request.artifactKey,
        strategy: request.strategy,
        framework: request.framework,
      })
      callback(null, {
        message: "Deployment Queued",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },
}
