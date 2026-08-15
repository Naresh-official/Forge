import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"

import type { BuildRequest, BuildResponse } from "@forge/contracts"
import { builderQueue } from "@/queue/queue"

export const builderService = {
    async build(
        call: ServerUnaryCall<BuildRequest, BuildResponse>,
        callback: sendUnaryData<BuildResponse>
    ) {
        try {
            const request = call.request
            console.log("Received build request", request)
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
