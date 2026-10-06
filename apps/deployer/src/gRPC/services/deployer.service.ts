import type { ServerUnaryCall, sendUnaryData } from "@grpc/grpc-js"
import type {
  DeleteDeploymentsRequest,
  DeleteDeploymentsResponse,
  DeployRequest,
  DeployResponse,
  ScaleRequest,
  ScaleResponse,
} from "@forge/contracts"
import { deployerQueue } from "@/queue/queue"
import {
  KubernetesClient,
  appNameForDeployment,
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
