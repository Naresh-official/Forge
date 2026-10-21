import type { ApiResponse } from "@forge/types/apiResponses"
import type {
  ProjectResourcesResponse,
  ProjectResourceSettings,
  UpdateProjectResourcesInput,
} from "@forge/types/resources"
import { api } from "./client"

/**
 * A project's resource picture: the allocation the user selected, live usage
 * read from Kubernetes, replica counts and autoscaler state.
 *
 * Meant to be polled — every call reads the cluster's metrics API.
 */
export function getProjectResources(projectId: string) {
  return api<ApiResponse<ProjectResourcesResponse>>(
    `/projects/${projectId}/resources`,
    { method: "GET" }
  )
}

/**
 * Changes the project's resource plan (and autoscaling). The plan is written
 * to the project's current deployment — which later deployments inherit — and
 * applied to the running workload without a rebuild.
 */
export function updateProjectResources(
  projectId: string,
  input: UpdateProjectResourcesInput
) {
  return api<ApiResponse<ProjectResourceSettings>>(
    `/projects/${projectId}/resources`,
    { method: "PATCH", body: JSON.stringify(input) }
  )
}
