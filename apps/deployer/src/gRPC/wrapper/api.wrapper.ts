import type {
  DeploymentStartedRequest,
  DeploymentStartedResponse,
  DeploymentCompletedRequest,
  DeploymentCompletedResponse,
} from "@forge/contracts"
import { api } from "../clients/api.client"

function callUnary<TRequest, TResponse>(
  fn: (
    request: TRequest,
    callback: (error: Error | null, response: TResponse) => void
  ) => unknown,
  request: TRequest
): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    fn(request, (error, response) => {
      if (error) {
        reject(error)
        return
      }
      resolve(response)
    })
  })
}

export async function deploymentStarted(
  request: DeploymentStartedRequest
): Promise<DeploymentStartedResponse> {
  return callUnary(
    (req, cb) => api.apiClient.deploymentStarted(req, cb),
    request
  )
}

export async function deploymentCompleted(
  request: DeploymentCompletedRequest
): Promise<DeploymentCompletedResponse> {
  return callUnary(
    (req, cb) => api.apiClient.deploymentCompleted(req, cb),
    request
  )
}
