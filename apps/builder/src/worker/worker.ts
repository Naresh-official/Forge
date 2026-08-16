import { Worker } from "bullmq"
import { builderConfig } from "@forge/config"
import { connection, type BuilderQueueJob } from "@/queue/queue"
import { buildStarted } from "@/gRPC/wrapper/api.wrapper"
import { cloneGitRepository } from "./features/git"
import { detectProject } from "./features/detect"
import { buildNodeProject } from "./features/builders/node.builder"
import { createBuildLogger } from "./features/logs/build-logs"

const workerId = process.env.WORKER_ID ?? "unknown"

const worker = new Worker<BuilderQueueJob>(
    builderConfig.defaultQueueOptions.name,
    async (job) => {
        const { buildId } = job.data

        console.log(`[Worker ${workerId}] Processing build ${buildId}`)

        const response = await buildStarted({
            buildId,
        })

        const repoPath = await cloneGitRepository(response)

        const logger = createBuildLogger(repoPath, buildId)

        const detection = detectProject(repoPath)

        if (detection.strategy === "node") {
            if (detection.packageRunner === undefined) {
                throw new Error("Package runner is undefined")
            }

            if (detection.framework === undefined) {
                throw new Error("Framework is undefined")
            }

            const output = await buildNodeProject({
                projectPath: repoPath,
                packageRunner: detection.packageRunner,
                framework: detection.framework,
                logger,
            })

            console.log({ output })
        }

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
