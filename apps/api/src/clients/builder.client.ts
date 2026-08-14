import grpc from "@grpc/grpc-js"

import { BuilderServiceClient } from "@forge/contracts"

const builderAddress = process.env.BUILDER_GRPC_URL ?? "localhost:8001"

const client = new BuilderServiceClient(
    builderAddress,
    grpc.credentials.createInsecure()
)

export const builder = {
    client,
}
