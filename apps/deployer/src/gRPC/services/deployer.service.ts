import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"
import type {
  CancelDeploymentsRequest,
  CancelDeploymentsResponse,
  CancelDeploymentRequest,
  CancelDeploymentResponse,
  DeleteDeploymentsRequest,
  DeleteDeploymentsResponse,
  DeployRequest,
  DeployResponse,
  GetDeploymentMetricsRequest,
  GetDeploymentMetricsResponse,
  ScaleRequest,
  ScaleResponse,
  SyncEnvironmentVariablesRequest,
  SyncEnvironmentVariablesResponse,
  UpdateDeploymentResourcesRequest,
  UpdateDeploymentResourcesResponse,
} from "@forge/contracts"
import {
  deployerCancelQueue,
  deployerQueue,
  type CancelReason,
} from "@/queue/queue"
import {
  KubernetesClient,
  appNameForDeployment,
  envSecretNameForDeployment,
  namespaceForDeployment,
} from "@/kubernetes"
import logger from "@/utils/logger"

/*
 * The Kubernetes client loads the kubeconfig, so it is created lazily rather
 * than at module load — the gRPC server must start even where no kubeconfig
 * is present (e.g. before cluster credentials are mounted).
 */
let kubernetes: KubernetesClient | undefined
function getKubernetes(): KubernetesClient {
  return (kubernetes ??= new KubernetesClient())
}

const CANCEL_REASONS = ["redeploy", "project_deleted", "manual"] as const

/**
 * The reason is a free-form string on the wire (it is informational only), so
 * unknown values are normalised rather than rejected.
 */
function toCancelReason(reason: string): CancelReason {
  return (CANCEL_REASONS as readonly string[]).includes(reason)
    ? (reason as CancelReason)
    : "manual"
}

export const deployerService = {
  async deploy(
    call: ServerUnaryCall<DeployRequest, DeployResponse>,
    callback: sendUnaryData<DeployResponse>
  ) {
    try {
      const request = call.request
      logger.info({ request }, "Received deploy request")
      await deployerQueue.add("deploy", {
        deploymentId: request.deploymentId,
        projectId: request.projectId,
        buildId: request.buildId,
        imageUrl: request.imageUrl,
        imageTag: request.imageTag,
        artifactBucket: request.artifactBucket,
        artifactKey: request.artifactKey,
        strategy: request.strategy,
        framework: request.framework,
        cpuMillicores: request.cpuMillicores,
        memoryMb: request.memoryMb,
        ephemeralStorageMb: request.ephemeralStorageMb,
        autoscalingEnabled: request.autoscalingEnabled,
      })
      callback(null, {
        message: "Deployment Queued",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Scales an already-deployed workload to pause (0 replicas) or resume
   * (1 replica). Called by the API when a project's status changes.
   */
  async scale(
    call: ServerUnaryCall<ScaleRequest, ScaleResponse>,
    callback: sendUnaryData<ScaleResponse>
  ) {
    try {
      const { projectId, deploymentId, replicas, autoscalingEnabled } =
        call.request

      if (!projectId || !deploymentId) {
        throw new Error("projectId and deploymentId are required to scale")
      }

      const namespace = namespaceForDeployment(projectId, deploymentId)
      const name = appNameForDeployment(deploymentId)

      await getKubernetes().scaleWorkload({
        namespace,
        name,
        replicas,
        autoscalingEnabled,
      })

      logger.info(`Scaled ${namespace}/${name} to ${replicas} replicas`)

      callback(null, {
        message: `Scaled ${name} to ${replicas} replicas`,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Rewrites the env Secret of each given deployment and rolls its workload
   * so running pods pick the new values up.
   *
   * The request carries plaintext variables, so neither the request nor the
   * variables may ever be logged. Deployments with no running workload are
   * reported back instead of failing the call.
   */
  async syncEnvironmentVariables(
    call: ServerUnaryCall<
      SyncEnvironmentVariablesRequest,
      SyncEnvironmentVariablesResponse
    >,
    callback: sendUnaryData<SyncEnvironmentVariablesResponse>
  ) {
    try {
      const { projectId, deploymentIds, environmentVariables } = call.request

      if (!projectId) {
        throw new Error("projectId is required to sync environment variables")
      }

      if (deploymentIds.length === 0) {
        callback(null, {
          message: "No deployments to update",
          updatedDeploymentIds: [],
        })
        return
      }

      const kubernetes = getKubernetes()
      const updatedDeploymentIds: string[] = []

      for (const deploymentId of deploymentIds) {
        const result = await kubernetes.syncEnvironmentSecret({
          namespace: namespaceForDeployment(projectId, deploymentId),
          name: appNameForDeployment(deploymentId),
          secretName: envSecretNameForDeployment(deploymentId),
          variables: environmentVariables,
        })

        if (result === "updated") {
          updatedDeploymentIds.push(deploymentId)
        }
      }

      // Names and counts only — never the variable values.
      logger.info(
        `Synced environment variables for ${updatedDeploymentIds.length}/${deploymentIds.length} deployment(s) of project ${projectId}`
      )

      callback(null, {
        message: `Updated ${updatedDeploymentIds.length} deployment(s)`,
        updatedDeploymentIds,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Cancel (pause) a single deployment's workload. Typically called by the
   * API after a newer deployment becomes READY, so the older deployment stops
   * serving traffic. The work is queued: the worker pauses the workload and
   * treats a deployment with no running workload as a no-op.
   */
  async cancelDeployment(
    call: ServerUnaryCall<CancelDeploymentRequest, CancelDeploymentResponse>,
    callback: sendUnaryData<CancelDeploymentResponse>
  ) {
    try {
      const { deploymentId, projectId, reason } = call.request

      if (!deploymentId || !projectId) {
        throw new Error(
          "deploymentId and projectId are required to cancel a deployment"
        )
      }

      await deployerCancelQueue.add("cancel-deployment", {
        deploymentId,
        projectId,
        reason: toCancelReason(reason),
      })

      callback(null, {
        canceled: true,
        skipped: false,
        message: `Queued cancellation of deployment ${deploymentId}`,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Cancel (pause) several deployments of one project. Used by the redeploy
   * path to stop the older deployments once the newer one is READY. Queued
   * like the single-deployment variant; the worker skips deployments with no
   * running workload.
   */
  async cancelDeployments(
    call: ServerUnaryCall<CancelDeploymentsRequest, CancelDeploymentsResponse>,
    callback: sendUnaryData<CancelDeploymentsResponse>
  ) {
    try {
      const { projectId, deploymentIds, reason } = call.request

      if (!projectId) {
        throw new Error("projectId is required to cancel deployments")
      }

      if (deploymentIds.length === 0) {
        callback(null, {
          canceled: [],
          skipped: [],
          message: `No deployments to cancel for project ${projectId}`,
        })
        return
      }

      await deployerCancelQueue.add("cancel-deployments", {
        projectId,
        deploymentIds: [...deploymentIds],
        reason: toCancelReason(reason),
      })

      callback(null, {
        canceled: [...deploymentIds],
        skipped: [],
        message: `Queued cancellation of ${deploymentIds.length} deployment(s) for project ${projectId}`,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Applies a new resource plan to an already-deployed workload. Called by the
   * project settings, so a plan change takes effect without a rebuild: the
   * container resources are patched, the HPA is created or removed to match,
   * and the rollout is awaited.
   *
   * Idempotent and safe to retry. A deployment with no Kubernetes workload is
   * reported as `skipped` instead of failing — static projects never reach
   * the cluster.
   */
  async updateDeploymentResources(
    call: ServerUnaryCall<
      UpdateDeploymentResourcesRequest,
      UpdateDeploymentResourcesResponse
    >,
    callback: sendUnaryData<UpdateDeploymentResourcesResponse>
  ) {
    try {
      const {
        projectId,
        deploymentId,
        cpuMillicores,
        memoryMb,
        ephemeralStorageMb,
        autoscalingEnabled,
      } = call.request

      if (!projectId || !deploymentId) {
        throw new Error(
          "projectId and deploymentId are required to update resources"
        )
      }

      const result = await getKubernetes().updateWorkloadResources({
        namespace: namespaceForDeployment(projectId, deploymentId),
        name: appNameForDeployment(deploymentId),
        resources: { cpuMillicores, memoryMb, ephemeralStorageMb },
        autoscalingEnabled,
      })

      logger.info(
        `Updated resources for deployment ${deploymentId}: updated=${result.updated} skipped=${result.skipped} rolloutReady=${result.rolloutReady}`
      )

      callback(null, {
        updated: result.updated,
        skipped: result.skipped,
        rolloutReady: result.rolloutReady,
        message: result.skipped
          ? "No Kubernetes workload to update"
          : result.rolloutReady
            ? "Resource plan applied and the rollout is available"
            : "Resource plan applied but the rollout did not become available in time",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Reports a deployment's live resource usage, allocation, replica state and
   * autoscaler state. Read-only: the API calls this for the Resources tab, so
   * it must never mutate the cluster.
   */
  async getDeploymentMetrics(
    call: ServerUnaryCall<
      GetDeploymentMetricsRequest,
      GetDeploymentMetricsResponse
    >,
    callback: sendUnaryData<GetDeploymentMetricsResponse>
  ) {
    try {
      const { projectId, deploymentId } = call.request

      if (!projectId || !deploymentId) {
        throw new Error(
          "projectId and deploymentId are required to read metrics"
        )
      }

      const metrics = await getKubernetes().getWorkloadMetrics({
        namespace: namespaceForDeployment(projectId, deploymentId),
        name: appNameForDeployment(deploymentId),
      })

      const autoscaling = metrics.autoscaling

      callback(null, {
        available: metrics.available,
        message: metrics.message,
        replicasDesired: metrics.replicasDesired,
        replicasReady: metrics.replicasReady,
        cpuUsageMillicores: metrics.cpuUsageMillicores,
        cpuRequestMillicores: metrics.cpuRequestMillicores,
        memoryUsageMb: metrics.memoryUsageMb,
        memoryRequestMb: metrics.memoryRequestMb,
        metricsAvailable: metrics.metricsAvailable,
        autoscalingEnabled: autoscaling !== null,
        minReplicas: autoscaling?.minReplicas ?? 0,
        maxReplicas: autoscaling?.maxReplicas ?? 0,
        targetCpuUtilization: autoscaling?.targetCpuUtilization ?? 0,
        // -1 means "the autoscaler has no CPU reading yet".
        currentCpuUtilization: autoscaling?.currentCpuUtilization ?? -1,
        hpaCurrentReplicas: autoscaling?.currentReplicas ?? 0,
        hpaDesiredReplicas: autoscaling?.desiredReplicas ?? 0,
        scalingStatus: autoscaling?.status ?? "",
        scalingMessage: autoscaling?.message ?? "",
        metricsTimestamp: metrics.metricsTimestamp ?? "",
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },

  /**
   * Deletes the Kubernetes namespaces for all of a project's deployments.
   * Called by the API when a project is deleted. Missing namespaces are
   * ignored, so the call is idempotent.
   */
  async deleteDeployments(
    call: ServerUnaryCall<DeleteDeploymentsRequest, DeleteDeploymentsResponse>,
    callback: sendUnaryData<DeleteDeploymentsResponse>
  ) {
    try {
      const { projectId, deploymentIds } = call.request

      if (!projectId) {
        throw new Error("projectId is required to delete deployments")
      }

      const kubernetes = getKubernetes()

      for (const deploymentId of deploymentIds) {
        const namespace = namespaceForDeployment(projectId, deploymentId)
        await kubernetes.deleteNamespace(namespace)
        logger.info(`Deleted namespace ${namespace}`)
      }

      callback(null, {
        message: `Deleted ${deploymentIds.length} namespace(s)`,
      })
    } catch (error) {
      callback(error as Error, null)
    }
  },
}
