import grpc from "@grpc/grpc-js"

import { BuilderServiceClient, HealthServiceClient } from "@forge/contracts"
import apiConfig from "@forge/config/api"

const builderClient = new BuilderServiceClient(
    apiConfig.builderGRPCUrl,
    grpc.credentials.createInsecure()
)

const healthClient = new HealthServiceClient(
    apiConfig.builderGRPCUrl,
    grpc.credentials.createInsecure()
)

export const builder = {
    builderClient,
    healthClient,
}
