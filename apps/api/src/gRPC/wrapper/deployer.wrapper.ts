import type {
  CancelDeploymentRequest,
  CancelDeploymentResponse,
  CancelDeploymentsRequest,
  CancelDeploymentsResponse,
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
import { deployer } from "../clients/deployer.client"

export function deployWrapper(request: DeployRequest): Promise<DeployResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.deploy(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Ask the deployer to scale a project's workload (pause = 0 replicas,
 * resume = 1). No-op on the deployer side when the deployment has no
 * Kubernetes resources.
 */
export function scaleDeploymentWrapper(
  request: ScaleRequest
): Promise<ScaleResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.scale(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Push a project's environment variables to the deployer, which rewrites the
 * env Secret in each running deployment's namespace and rolls the workload.
 * The values are decrypted by the API before this call — the deployer never
 * holds the encryption key.
 */
export function syncEnvironmentVariablesWrapper(
  request: SyncEnvironmentVariablesRequest
): Promise<SyncEnvironmentVariablesResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.syncEnvironmentVariables(
      request,
      (error, response) => {
        if (error) {
          reject(error)
          return
        }
        resolve(response)
      }
    )
  })
}

/**
 * Read a deployment's live resource usage and autoscaler state. The deployer
 * is the only service that talks to the Kubernetes API, so the metrics are
 * always read there and forwarded to the API.
 */
export function getDeploymentMetricsWrapper(
  request: GetDeploymentMetricsRequest
): Promise<GetDeploymentMetricsResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.getDeploymentMetrics(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Ask the deployer to delete the Kubernetes namespaces belonging to a
 * project's deployments. Used when a project is deleted.
 */
export function deleteDeploymentsWrapper(
  request: DeleteDeploymentsRequest
): Promise<DeleteDeploymentsResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.deleteDeployments(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Ask the deployer to apply a new resource plan to an already-deployed
 * workload. The deployer patches the container's requests/limits, creates or
 * removes the HPA and waits for the rollout — the API never talks to
 * Kubernetes directly.
 */
export function updateDeploymentResourcesWrapper(
  request: UpdateDeploymentResourcesRequest
): Promise<UpdateDeploymentResourcesResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.updateDeploymentResources(
      request,
      (error, response) => {
        if (error) {
          reject(error)
          return
        }
        resolve(response)
      }
    )
  })
}

/**
 * Ask the deployer to cancel (pause) a single deployment's workload.
 * The API typically uses this after a newer deployment becomes READY, so the
 * old deployment stops serving traffic. Cancellation is asynchronous and
 * best-effort: the returned job id can be used to reconcile later if the
 * caller wants, but the API does not wait on it.
 */
export function cancelDeploymentWrapper(
  request: CancelDeploymentRequest
): Promise<CancelDeploymentResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.cancelDeployment(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

/**
 * Ask the deployer to cancel (pause) several deployments of a project.
 * Used by the redeploy path to stop older deployments once the new one is
 * READY.
 */
export function cancelDeploymentsWrapper(
  request: CancelDeploymentsRequest
): Promise<CancelDeploymentsResponse> {
  return new Promise((resolve, reject) => {
    deployer.deployerClient.cancelDeployments(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}
