import grpc from "@grpc/grpc-js"
import { deployerConfig } from "@forge/config"
import { DeployerApiServiceClient } from "@forge/contracts"

const apiClient = new DeployerApiServiceClient(
    deployerConfig.apiGRPCUrl,
    grpc.credentials.createInsecure()
)

export const api = {
    apiClient,
}
