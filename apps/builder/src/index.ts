import { builderConfig } from "@forge/config"
import createServer from "./gRPC/server"
import grpc from "@grpc/grpc-js"
import { builderQueue, rawClient } from "./queue/queue"
import { spawn, type Subprocess } from "bun"

const grpcServer = createServer()

const workerProcesses: Subprocess[] = []

async function checkQueue() {
    try {
        const result = await rawClient.ping()

        if (result !== "PONG") {
            throw new Error(`Unexpected Redis response: ${result}`)
        }

        await builderQueue.getJobCounts()

        console.log("Builder queue is healthy")

        await builderQueue.obliterate({
            force: true,
        })
    } catch (error) {
        console.error("Builder queue health check failed:", error)
        throw error
    }
}

function startGrpcServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        grpcServer.bindAsync(
            `0.0.0.0:${builderConfig.grpcPort}`,
            grpc.ServerCredentials.createInsecure(),
            (error, port) => {
                if (error) {
                    reject(error)
                    return
                }

                console.log(`Builder listening on :${port}`)
                resolve()
            }
        )
    })
}

function startWorkers() {
    const workerCount =
        builderConfig.nodeEnv === "development" ? 1 : builderConfig.workerCount

    console.log(`Starting ${workerCount} builder workers`)

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

        console.log(`Started worker ${i} (PID: ${worker.pid})`)

        worker.exited.then((exitCode) => {
            console.log(
                `Worker ${i} (PID: ${worker.pid}) exited with code ${exitCode}`
            )
        })
    }
}

async function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down Builder...`)

    // Stop accepting new gRPC requests
    grpcServer.tryShutdown((error) => {
        if (error) {
            console.error("Failed to shutdown gRPC server:", error)
        }
    })

    // Stop worker processes
    for (const worker of workerProcesses) {
        try {
            worker.kill("SIGTERM")
        } catch (error) {
            console.error(`Failed to stop worker ${worker.pid}:`, error)
        }
    }

    // Wait for workers to exit
    await Promise.all(workerProcesses.map((worker) => worker.exited))

    // Close BullMQ queue connection
    await builderQueue.close()

    console.log("Builder shutdown complete")

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
        console.error("Failed to start Builder:", error)
        process.exit(1)
    }
}

void start()
