import type {
    BuildRequest,
    BuildResponse,
    HealthResponse,
} from "@forge/contracts"
import { builder } from "../clients/builder.client"

export function startBuildWrapper(
    request: BuildRequest
): Promise<BuildResponse> {
    return new Promise((resolve, reject) => {
        builder.builderClient.build(request, (error, response) => {
            if (error) {
                reject(error)
                return
            }
            resolve(response)
        })
    })
}

export function healthCheckWrapper(): Promise<HealthResponse> {
    return new Promise((resolve, reject) => {
        builder.healthClient.check({}, (error, response) => {
            if (error) {
                reject(error)
                return
            }
            resolve(response)
        })
    })
}
