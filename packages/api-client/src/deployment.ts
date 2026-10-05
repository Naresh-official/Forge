import type { ApiResponse } from "@forge/types/apiResponses"
import type {
  CreateRepositoryInput,
  StartDeploymentResponse,
} from "@forge/types/deployment"
import { api } from "./client"

/**
 * Imports a repository as a project and queues its first build, returning
 * the build that was created.
 */
export function createDeployment(input: CreateRepositoryInput) {
  return api<ApiResponse<StartDeploymentResponse>>("/deployments/new", {
    method: "POST",
    body: JSON.stringify(input),
  })
}
