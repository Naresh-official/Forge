import type {
    BuildStartedRequest,
    BuildStartedResponse,
    BuildCompletedRequest,
    BuildCompletedResponse,
} from "@forge/contracts"
import { api } from "../clients/api.client"

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

export async function buildCompleted(
    request: BuildCompletedRequest
): Promise<BuildCompletedResponse> {
    return new Promise((resolve, reject) => {
        api.apiClient.buildCompleted(request, (error, response) => {
            if (error) {
                reject(error)
                return
            }
            resolve(response)
        })
    })
}
