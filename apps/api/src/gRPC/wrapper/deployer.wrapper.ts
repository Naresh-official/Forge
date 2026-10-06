import type {
  DeleteDeploymentsRequest,
  DeleteDeploymentsResponse,
  DeployRequest,
  DeployResponse,
  ScaleRequest,
  ScaleResponse,
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
