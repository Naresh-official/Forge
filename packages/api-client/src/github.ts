import { apiUrl } from "./client"

/**
 * GitHub App installation flow. Opening it lets the user install the app or
 * grant it access to additional repositories.
 */
export function getGithubInstallUrl() {
  return apiUrl("/github/install")
}
