import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"

import type { BuildRequest, BuildResponse } from "@forge/contracts"

import { BuilderServiceService } from "@forge/contracts"

export const builderService = {
    async build(
        call: ServerUnaryCall<BuildRequest, BuildResponse>,
        callback: sendUnaryData<BuildResponse>
    ) {
        try {
            const request = call.request
            console.log("Received build request", request)
            callback(null, {
                message: "Build completed",
            })
        } catch (error) {
            callback(error as Error, null)
        }
    },
}
