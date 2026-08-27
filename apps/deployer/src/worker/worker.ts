import { Worker } from "bullmq"
import { deployerConfig } from "@forge/config"
import { connection, type DeployerQueueJob } from "@/queue/queue"
import { deploymentStarted } from "@/gRPC/wrapper/api.wrapper"

const workerId = process.env.WORKER_ID ?? "unknown"

const worker = new Worker<DeployerQueueJob>(
    deployerConfig.defaultQueueOptions.name,
    async (job) => {
        const { deploymentId, projectId } = job.data

        console.log(
            `[Worker ${workerId}] Processing deployment ${deploymentId} for project ${projectId}`
        )

        try {
            const response = await deploymentStarted({
                deploymentId,
            })

            console.log(
                `[Worker ${workerId}] Deployment ${deploymentId} status updated to DEPLOYING:`,
                response
            )

            return {
                success: true,
                deploymentId,
            }
        } catch (error) {
            console.error(
                `[Worker ${workerId}] Failed to process deployment ${deploymentId}:`,
                error
            )
            throw error
        }
    },
    {
        connection,
    }
)

worker.on("ready", () => {
    console.log(`[Worker ${workerId}] Ready`)
})

worker.on("error", (error) => {
    console.error(`[Worker ${workerId}] Error:`, error)
})

worker.on("failed", (job, error) => {
    console.error(`[Worker ${workerId}] Job ${job?.id} failed:`, error)
})

worker.on("completed", (job, result) => {
    console.log(`[Worker ${workerId}] Job ${job?.id} completed:`, result)
})

async function shutdown(signal: string) {
    console.log(`[Worker ${workerId}] Received ${signal}, shutting down...`)

    await worker.close()

    console.log(`[Worker ${workerId}] Shutdown complete`)

    process.exit(0)
}

process.on("SIGINT", () => {
    void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
})
