import grpc from "@grpc/grpc-js"

import { ApiServiceService, HealthServiceService } from "@forge/contracts"

import { apiService } from "./services/api.service"

function createServer() {
    const server = new grpc.Server()
    server.addService(ApiServiceService, apiService)

    return server
}

export default createServer
