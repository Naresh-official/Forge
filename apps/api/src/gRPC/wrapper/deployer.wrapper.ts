import type {
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
