import type { BuildStartedRequest } from "@forge/contracts"
import { api } from "../clients/api.client"
import type { BuildStartedResponse } from "@forge/contracts"

export async function buildStarted(
    request: BuildStartedRequest
): Promise<BuildStartedResponse> {
    return new Promise((resolve, reject) => {
        api.apiClient.buildStarted(request, (error, response) => {
            if (error) {
                reject(error)
                return
            }
            resolve(response)
        })
    })
}
