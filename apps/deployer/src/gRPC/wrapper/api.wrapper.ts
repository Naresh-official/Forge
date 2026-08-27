import type {
    DeploymentStartedRequest,
    DeploymentStartedResponse,
} from "@forge/contracts"
import { api } from "../clients/api.client"

export async function deploymentStarted(
    request: DeploymentStartedRequest
): Promise<DeploymentStartedResponse> {
    return new Promise((resolve, reject) => {
        api.apiClient.deploymentStarted(request, (error, response) => {
            if (error) {
                reject(error)
                return
            }
            resolve(response)
        })
    })
}
