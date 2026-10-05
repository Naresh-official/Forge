import type { ApiResponse } from "@forge/types/apiResponses"
import type { ListRepositoriesResponse } from "@forge/types/github"
import { api } from "./client"

/** Repositories the user has granted the Forge GitHub App access to. */
export function listRepositories() {
  return api<ApiResponse<ListRepositoriesResponse>>("/repositories", {
    method: "GET",
  })
}
