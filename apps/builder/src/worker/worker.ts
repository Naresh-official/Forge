import { Worker } from "bullmq"
import { builderConfig } from "@forge/config"
import { connection, type BuilderQueueJob } from "@/queue/queue"
import { buildStarted } from "@/gRPC/wrapper/api.wrapper"
import { cloneGitRepository } from "./features/git"

const workerId = process.env.WORKER_ID ?? "unknown"

const worker = new Worker<BuilderQueueJob>(
    builderConfig.defaultQueueOptions.name,
    async (job) => {
        console.log(`[Worker ${workerId}] Processing build ${job.data.buildId}`)

        // TODO: build logic

        const response = await buildStarted({
            buildId: job.data.buildId,
        })

        const repoPath = await cloneGitRepository(response)

        return {
            success: true,
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
    console.log(`[Worker ${workerId}] Job ${job.id} completed:`, result)
})

async function shutdown(signal: string) {
    console.log(`[Worker ${workerId}] Received ${signal}, shutting down...`)

    // stop taking new jobs and wait for the current job
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
