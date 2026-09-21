import { Worker } from "bullmq"
import { deployerConfig } from "@forge/config"
import { connection, type DeployerQueueJob } from "@/queue/queue"
import { deploymentStarted } from "@/gRPC/wrapper/api.wrapper"
import {
  KubernetesClient,
  appNameForDeployment,
  namespaceForBuild,
} from "@/kubernetes"

const workerId = process.env.WERKER_ID ?? process.env.WORKER_ID ?? "unknown"

const k8s = new KubernetesClient()

const worker = new Worker<DeployerQueueJob>(
  deployerConfig.defaultQueueOptions.name,
  async (job) => {
    const { deploymentId, projectId, buildId, imageUrl, imageTag, strategy } =
      job.data

    console.log(
      `[Worker ${workerId}] Processing deployment ${deploymentId} for project ${projectId}`
    )

    try {
      // 1. Notify the API that deployment has started
      const response = await deploymentStarted({ deploymentId })
      console.log(
        `[Worker ${workerId}] Deployment ${deploymentId} status updated to DEPLOYING:`,
        response
      )

      // 2. Only container strategies can be deployed to Kubernetes
      const isContainer =
        strategy === "dockerfile" ||
        strategy === "docker-compose" ||
        (strategy === "node" && imageUrl)

      if (!isContainer) {
        console.log(
          `[Worker ${workerId}] Strategy "${strategy ?? "unknown"}" is not a container deployment — skipping K8s deploy`
        )
        return { success: true, deploymentId, skipped: true }
      }

      if (!imageUrl) {
        throw new Error(
          `No image URL provided for container deployment ${deploymentId}`
        )
      }

      // 3. Build the full image reference
      const fullImage = imageTag ? `${imageUrl}:${imageTag}` : imageUrl

      // 4. Compute namespace and resource names
      const namespace = namespaceForBuild(buildId)
      const appName = appNameForDeployment(deploymentId)

      console.log(
        `[Worker ${workerId}] Deploying ${fullImage} to namespace ${namespace}`
      )

      // 5. Deploy to Kubernetes
      //    - Namespace: forge-project-<buildId>
      //    - Resources: 0.5–1 CPU cores, 512 MB – 2 GB RAM
      //    - No autoscaling (replicas = 1)
      await k8s.deployContainer({
        namespace,
        name: appName,
        image: fullImage,
        containerPort: 80,
      })

      console.log(
        `[Worker ${workerId}] Successfully deployed ${deploymentId} to namespace ${namespace}`
      )

      return {
        success: true,
        deploymentId,
        namespace,
        appName,
        image: fullImage,
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
