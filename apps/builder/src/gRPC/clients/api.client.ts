import grpc from "@grpc/grpc-js"

import { builderConfig } from "@forge/config/builder"
import { ApiServiceClient } from "@forge/contracts"

const apiClient = new ApiServiceClient(
    builderConfig.apiGRPCUrl,
    grpc.credentials.createInsecure()
)

export const api = {
    apiClient,
}
