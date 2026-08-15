import type { HealthRequest, HealthResponse } from "@forge/contracts"
import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"

export const healthService = {
    async check(
        call: ServerUnaryCall<HealthRequest, HealthResponse>,
        callback: sendUnaryData<HealthResponse>
    ) {
        callback(null, {
            healthy: true,
            message: "Builder is healthy",
        })
    },
}
