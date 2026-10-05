import { deployerConfig } from "@forge/config"
import createServer from "./gRPC/server"
import grpc from "@grpc/grpc-js"
import { deployerQueue, rawClient } from "./queue/queue"
import { spawn, type Subprocess } from "bun"
import logger from "@/utils/logger"

const grpcServer = createServer()

const workerProcesses: Subprocess[] = []

async function checkQueue() {
  try {
    const result = await rawClient.ping()

    if (result !== "PONG") {
      throw new Error(`Unexpected Redis response: ${result}`)
    }

    await deployerQueue.getJobCounts()

    logger.info("Deployer queue is healthy")

    await deployerQueue.obliterate({
      force: true,
    })
  } catch (error) {
    logger.error(error, "Deployer queue health check failed")
    throw error
  }
}

function startGrpcServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    grpcServer.bindAsync(
      `0.0.0.0:${deployerConfig.grpcPort}`,
      grpc.ServerCredentials.createInsecure(),
      (error, port) => {
        if (error) {
          reject(error)
          return
        }

        logger.info(`Deployer listening on :${port}`)
        resolve()
      }
    )
  })
}

function startWorkers() {
  const workerCount =
    deployerConfig.nodeEnv === "development" ? 1 : deployerConfig.workerCount

  logger.info(`Starting ${workerCount} deployer workers`)

  for (let i = 0; i < workerCount; i++) {
    // start workers as independent os process
    const worker = spawn(["bun", "run", "./src/worker/worker.ts"], {
      stdio: ["ignore", "inherit", "inherit"],
      env: {
        ...process.env,
        WORKER_ID: String(i),
      },
    })

    workerProcesses.push(worker)

    logger.info(`Started deployer worker ${i} (PID: ${worker.pid})`)

    worker.exited.then((exitCode) => {
      logger.info(
        `Deployer worker ${i} (PID: ${worker.pid}) exited with code ${exitCode}`
      )
    })
  }
}

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down Deployer...`)

  // Stop accepting new gRPC requests
  grpcServer.tryShutdown((error) => {
    if (error) {
      logger.error(error, "Failed to shutdown gRPC server")
    }
  })

  // Stop worker processes
  for (const worker of workerProcesses) {
    try {
      worker.kill("SIGTERM")
    } catch (error) {
      logger.error(error, `Failed to stop worker ${worker.pid}`)
    }
  }

  // Wait for workers to exit
  await Promise.all(workerProcesses.map((worker) => worker.exited))

  // Close BullMQ queue connection
  await deployerQueue.close()

  logger.info("Deployer shutdown complete")

  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})

async function start() {
  try {
    await checkQueue()
    await startGrpcServer()

    startWorkers()
  } catch (error) {
    logger.error(error, "Failed to start Deployer")
    process.exit(1)
  }
}

void start()
