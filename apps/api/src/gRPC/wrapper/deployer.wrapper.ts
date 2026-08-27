import type { DeployRequest, DeployResponse } from "@forge/contracts"
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
