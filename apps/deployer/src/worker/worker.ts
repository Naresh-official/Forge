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
import logger from "@/utils/logger"

const workerId = process.env.WERKER_ID ?? process.env.WORKER_ID ?? "unknown"

const k8s = new KubernetesClient()

const worker = new Worker<DeployerQueueJob>(
  deployerConfig.defaultQueueOptions.name,
  async (job) => {
    const {
      deploymentId,
      projectId,
      buildId,
      imageUrl,
      imageTag,
      strategy,
      cpuMillicores,
      memoryMb,
      ephemeralStorageMb,
      autoscalingEnabled,
    } = job.data

    /*
     * Full image reference, hoisted so the failure handler can report which
     * image the failed deployment was attempting to run.
     */
    let fullImage = imageUrl
      ? imageTag
        ? `${imageUrl}:${imageTag}`
        : imageUrl
      : ""

    logger.info(
      `[Worker ${workerId}] Processing deployment ${deploymentId} for project ${projectId}`
    )

    try {
      // 1. Notify the API that deployment has started
      const response = await deploymentStarted({ deploymentId })
      logger.info(
        { response },
        `[Worker ${workerId}] Deployment ${deploymentId} status updated to DEPLOYING`
      )

      // 2. Only container strategies can be deployed to Kubernetes
      const isContainer =
        strategy === "dockerfile" ||
        strategy === "docker-compose" ||
        (strategy === "node" && imageUrl)

      if (!isContainer) {
        logger.info(
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

      logger.info(
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
      //    - Autoscaling projects get an HPA (1–5 replicas, 80% CPU target);
      //      others run a single replica
      //    - Pod labels carry the forge.dev project/deployment ids so the
      //      runtime log collector (Fluent Bit) can route logs
      const { rolloutReady } = await k8s.deployContainer({
        namespace,
        name: appName,
        image: fullImage,
        containerPort: 80,
        projectId,
        deploymentId,
        imagePullSecret: "forge-ecr-pull",
        pullSecretCredentials: {
          registryHost: token.registryHost,
          username: token.username,
          password: token.password,
        },
        resources: {
          cpuMillicores: cpuMillicores ?? 0,
          memoryMb: memoryMb ?? 0,
          ephemeralStorageMb: ephemeralStorageMb ?? 0,
        },
        autoscalingEnabled: autoscalingEnabled ?? false,
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

      logger.info(
        { completion },
        `[Worker ${workerId}] Deployment ${deploymentId} marked ${
          rolloutReady ? "READY" : "FAILED"
        }`
      )

      logger.info(
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
      logger.error(
        error,
        `[Worker ${workerId}] Failed to process deployment ${deploymentId}`
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
        logger.error(
          reportError,
          `[Worker ${workerId}] Failed to report FAILED status for ${deploymentId}`
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
  logger.info(`[Worker ${workerId}] Ready`)
})

worker.on("error", (error) => {
  logger.error(error, `[Worker ${workerId}] Error`)
})

worker.on("failed", (job, error) => {
  logger.error(error, `[Worker ${workerId}] Job ${job?.id} failed`)
})

worker.on("completed", (job, result) => {
  logger.info({ result }, `[Worker ${workerId}] Job ${job?.id} completed`)
})

async function shutdown(signal: string) {
  logger.info(`[Worker ${workerId}] Received ${signal}, shutting down...`)

  await worker.close()

  logger.info(`[Worker ${workerId}] Shutdown complete`)

  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
