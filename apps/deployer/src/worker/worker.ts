import { Worker } from "bullmq"
import { deployerConfig } from "@forge/config"
import { getEcrAuthorizationToken } from "@forge/registry"
import { connection, type DeployerQueueJob } from "@/queue/queue"
import {
  deploymentStarted,
  deploymentCompleted,
} from "@/gRPC/wrapper/api.wrapper"
import {
  KubernetesClient,
  appNameForDeployment,
  namespaceForDeployment,
} from "@/kubernetes"

const workerId = process.env.WERKER_ID ?? process.env.WORKER_ID ?? "unknown"

const k8s = new KubernetesClient()

const worker = new Worker<DeployerQueueJob>(
  deployerConfig.defaultQueueOptions.name,
  async (job) => {
    const { deploymentId, projectId, buildId, imageUrl, imageTag, strategy } =
      job.data

    /*
     * Full image reference, hoisted so the failure handler can report which
     * image the failed deployment was attempting to run.
     */
    let fullImage = imageUrl
      ? imageTag
        ? `${imageUrl}:${imageTag}`
        : imageUrl
      : ""

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

        /*
         * Static deployments have no Kubernetes resources to create — the
         * artifact already lives in object storage. Mark them READY so they
         * don't get stuck in BUILDING.
         */
        await deploymentCompleted({
          deploymentId,
          status: "READY",
          message: `Static deployment (strategy: ${strategy ?? "unknown"}) — artifact ready`,
          imageUrl: fullImage,
        })

        return { success: true, deploymentId, skipped: true }
      }

      if (!imageUrl) {
        throw new Error(
          `No image URL provided for container deployment ${deploymentId}`
        )
      }

      // 3. Compute namespace and resource names
      const namespace = namespaceForDeployment(projectId, deploymentId)
      const appName = appNameForDeployment(deploymentId)

      console.log(
        `[Worker ${workerId}] Deploying ${fullImage} to namespace ${namespace}`
      )

      /*
       * 5. Fetch a short-lived ECR token so the cluster can pull the
       *    private image. The token (12h validity) is embedded in a
       *    docker-registry Secret created in the deployment namespace.
       */
      const token = await getEcrAuthorizationToken(
        deployerConfig.dockerRegistry
      )

      // 6. Deploy to Kubernetes
      //    - Namespace: forge-project-<projectId>-<deploymentId>
      //    - Resources: 0.5–1 CPU cores, 512 MB – 2 GB RAM
      //    - No autoscaling (replicas = 1)
      const { rolloutReady } = await k8s.deployContainer({
        namespace,
        name: appName,
        image: fullImage,
        containerPort: 80,
        imagePullSecret: "forge-ecr-pull",
        pullSecretCredentials: {
          registryHost: token.registryHost,
          username: token.username,
          password: token.password,
        },
      })

      /*
       * 7. Report the final deployment status (and image url) back to the
       *    API so it is persisted in the database. READY only when the
       *    Kubernetes rollout actually became available.
       */
      const completion = await deploymentCompleted({
        deploymentId,
        status: rolloutReady ? "READY" : "FAILED",
        message: rolloutReady
          ? "Deployment rollout is available"
          : "Rollout did not become available in time",
        imageUrl: fullImage,
      })

      console.log(
        `[Worker ${workerId}] Deployment ${deploymentId} marked ${
          rolloutReady ? "READY" : "FAILED"
        }:`,
        completion
      )

      console.log(
        `[Worker ${workerId}] ${
          rolloutReady
            ? "Successfully deployed"
            : "Deployed but rollout not ready for"
        } ${deploymentId} to namespace ${namespace}`
      )

      return {
        success: rolloutReady,
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

      /*
       * Best-effort: tell the API the deployment failed so the DB reflects
       * reality even when the worker itself blew up (bad image, k8s API
       * down, etc.). Failures of this report call are logged and ignored —
       * the original error is what gets rethrown for BullMQ.
       */
      try {
        await deploymentCompleted({
          deploymentId,
          status: "FAILED",
          message:
            error instanceof Error ? error.message : "Unknown deployment error",
          imageUrl: fullImage,
        })
      } catch (reportError) {
        console.error(
          `[Worker ${workerId}] Failed to report FAILED status for ${deploymentId}:`,
          reportError
        )
      }

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
