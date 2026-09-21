import { deployerService } from "./services/deployer.service"
import { healthService } from "./services/health.service"
import { DeployerServiceService, HealthServiceService } from "@forge/contracts"
import grpc from "@grpc/grpc-js"

function createServer() {
  const server = new grpc.Server()
  server.addService(DeployerServiceService, deployerService)
  server.addService(HealthServiceService, healthService)

  return server
}

export default createServer
