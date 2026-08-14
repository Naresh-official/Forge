import { builderService } from "@/services/builder.service"
import { BuilderServiceService } from "@forge/contracts"
import grpc from "@grpc/grpc-js"

function createServer() {
    const server = new grpc.Server()
    server.addService(BuilderServiceService, builderService)

    return server
}

export default createServer
