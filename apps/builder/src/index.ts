import { builderConfig } from "@forge/config"
import createServer from "./grpc/server"
import grpc from "@grpc/grpc-js"

const grpcServer = createServer()

// stat server

grpcServer.bindAsync(
    `0.0.0.0:${builderConfig.port}`,
    grpc.ServerCredentials.createInsecure(),
    (error, port) => {
        if (error) {
            console.error(error)
            process.exit(1)
        }

        console.log(`Builder listening on :${port}`)
    }
)
