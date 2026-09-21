import grpc from "@grpc/grpc-js"

import { DeployerServiceClient } from "@forge/contracts"
import apiConfig from "@forge/config/api"

const deployerClient = new DeployerServiceClient(
  apiConfig.deployerGRPCUrl,
  grpc.credentials.createInsecure()
)

export const deployer = {
  deployerClient,
}
