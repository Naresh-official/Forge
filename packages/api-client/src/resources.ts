import type { ApiResponse } from "@forge/types/apiResponses"
import type { ProjectResourcesResponse } from "@forge/types/resources"
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
