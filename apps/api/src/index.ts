import app from "./app"
import apiConfig from "@forge/config/api"
import prisma from "./utils/db"
import logger from "./utils/logger"
import { healthCheckWrapper } from "./gRPC/wrapper/builder.wrapper"
import createServer from "./gRPC/server"
import grpc from "@grpc/grpc-js"

const PORT = apiConfig.port

const grpcServer = createServer()

function startGrpcServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        grpcServer.bindAsync(
            `0.0.0.0:${apiConfig.grpcPort}`,
            grpc.ServerCredentials.createInsecure(),
            (error, port) => {
                if (error) {
                    reject(error)
                    return
                }

                logger.info(`Api gRPC service listening on :${port}`)
                resolve()
            }
        )
    })
}

async function startServer() {
    try {
        await prisma.$connect()

        await prisma.$queryRaw`SELECT 1`

        logger.info("Database connected")

        await healthCheckWrapper()

        logger.info("Builder connected")

        await startGrpcServer()

        app.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT}`)
        })
    } catch (error) {
        logger.error(error, "Failed to start server")
        process.exit(1)
    }
}

startServer()
