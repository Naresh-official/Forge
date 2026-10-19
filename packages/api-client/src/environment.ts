import type { ApiResponse } from "@forge/types/apiResponses"
import type {
  CreateProjectEnvironmentVariableInput,
  CreateProjectEnvironmentVariableResponse,
  DeleteProjectEnvironmentVariableResponse,
  ListProjectEnvironmentVariablesResponse,
  UpdateProjectEnvironmentVariableInput,
  UpdateProjectEnvironmentVariableResponse,
} from "@forge/types/environment"
import { api } from "./client"

/**
 * A project's environment variables — keys and metadata only. The API never
 * returns decrypted values.
 */
export function listProjectEnvironmentVariables(projectId: string) {
  return api<ApiResponse<ListProjectEnvironmentVariablesResponse>>(
    `/projects/${projectId}/environment-variables`,
    { method: "GET" }
  )
}

/**
 * Adds a variable and applies the change to the project's workload (a new
 * build for static projects, an updated Secret for container ones).
 */
export function createProjectEnvironmentVariable(
  projectId: string,
  input: CreateProjectEnvironmentVariableInput
) {
  return api<ApiResponse<CreateProjectEnvironmentVariableResponse>>(
    `/projects/${projectId}/environment-variables`,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  )
}

/** Replaces an existing variable's value. */
export function updateProjectEnvironmentVariable(
  projectId: string,
  key: string,
  input: UpdateProjectEnvironmentVariableInput
) {
  return api<ApiResponse<UpdateProjectEnvironmentVariableResponse>>(
    `/projects/${projectId}/environment-variables/${encodeURIComponent(key)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  )
}

/** Removes a variable. */
export function deleteProjectEnvironmentVariable(
  projectId: string,
  key: string
) {
  return api<ApiResponse<DeleteProjectEnvironmentVariableResponse>>(
    `/projects/${projectId}/environment-variables/${encodeURIComponent(key)}`,
    { method: "DELETE" }
  )
}
