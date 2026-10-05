import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"

import type { BuildRequest, BuildResponse } from "@forge/contracts"
import { builderQueue } from "@/queue/queue"
import logger from "@/utils/logger"

export const builderService = {
  async build(
    call: ServerUnaryCall<BuildRequest, BuildResponse>,
    callback: sendUnaryData<BuildResponse>
  ) {
    try {
      const request = call.request
      logger.info({ request }, "Received build request")
      builderQueue.add("build", {
        buildId: request.buildId,
      })
      callback(null, {
        message: "Build Queued",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },
}
