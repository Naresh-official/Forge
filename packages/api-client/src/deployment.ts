import type { ApiResponse } from "@forge/types/apiResponses"
import type {
  CreateRepositoryInput,
  DeploymentDetailResponse,
  ListDeploymentsResponse,
  RedeployProjectResponse,
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

/** Every deployment of every project the user owns, newest first. */
export function listDeployments() {
  return api<ApiResponse<ListDeploymentsResponse>>("/deployments", {
    method: "GET",
  })
}

/** One deployment with its project, build and resource plan. */
export function getDeployment(deploymentId: string) {
  return api<ApiResponse<DeploymentDetailResponse>>(
    `/deployments/${deploymentId}`,
    { method: "GET" }
  )
}

/** Rebuilds this deployment's commit as a new deployment. */
export function redeployDeployment(deploymentId: string) {
  return api<ApiResponse<RedeployProjectResponse>>(
    `/deployments/${deploymentId}/redeploy`,
    { method: "POST" }
  )
}
