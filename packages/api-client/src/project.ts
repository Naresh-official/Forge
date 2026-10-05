import type {
  ApiResponse,
  ListProjectNamesResponse,
  ListProjectsResponse,
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
