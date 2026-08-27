import grpc from "@grpc/grpc-js"

import {
    ApiServiceService,
    DeployerApiServiceService,
    HealthServiceService,
} from "@forge/contracts"

import { apiService } from "./services/api.service"
import { deployerApiService } from "./services/deployer-api.service"

function createServer() {
    const server = new grpc.Server()
    server.addService(ApiServiceService, apiService)
    server.addService(DeployerApiServiceService, deployerApiService)

    return server
}

export default createServer
