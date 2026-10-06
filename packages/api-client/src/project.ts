import type {
  ApiResponse,
  DeleteProjectResponse,
  ListProjectDeploymentsResponse,
  ListProjectNamesResponse,
  ListProjectsResponse,
  ProjectSettingsResponse,
  ProjectStatus,
} from "@forge/types"
import { api } from "./client"

/** Full project details, including the latest deployment and repository. */
export function listProjects() {
  return api<ApiResponse<ListProjectsResponse>>("/projects/all", {
    method: "GET",
  })
}

/** Just the id and name of each project — cheap enough for the sidebar. */
export function listProjectNames() {
  return api<ApiResponse<ListProjectNamesResponse>>("/projects/list", {
    method: "GET",
  })
}

/** A project's deployments, newest first. Used to resolve real deployment IDs. */
export function listProjectDeployments(projectId: string) {
  return api<ApiResponse<ListProjectDeploymentsResponse>>(
    `/projects/${projectId}/deployments`,
    { method: "GET" }
  )
}

/** Renames a project. */
export function renameProject(projectId: string, name: string) {
  return api<ApiResponse<ProjectSettingsResponse>>(`/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  })
}

/** Pauses (scales to 0) or resumes (scales to 1) a project. */
export function setProjectStatus(projectId: string, status: ProjectStatus) {
  return api<ApiResponse<ProjectSettingsResponse>>(
    `/projects/${projectId}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }
  )
}

/** Deletes a project, its deployments and their external resources. */
export function deleteProject(projectId: string) {
  return api<ApiResponse<DeleteProjectResponse>>(`/projects/${projectId}`, {
    method: "DELETE",
  })
}
