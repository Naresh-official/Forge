import { builderService } from "./services/builder.service"
import { healthService } from "./services/health.service"
import { BuilderServiceService, HealthServiceService } from "@forge/contracts"
import grpc from "@grpc/grpc-js"

function createServer() {
    const server = new grpc.Server()
    server.addService(BuilderServiceService, builderService)
    server.addService(HealthServiceService, healthService)

    return server
}

export default createServer
