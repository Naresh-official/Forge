import type { DeploymentListItem } from "@forge/types/deployment"

/** Value meaning "no constraint" for the status and project filters. */
export const ALL_FILTER = "ALL"

export type DeploymentFilters = {
  /** Free-text search over project, message, commit SHA and branch. */
  search: string
  /** A deployment status, or {@link ALL_FILTER}. */
  status: string
  /** A project id, or {@link ALL_FILTER}. */
  projectId: string
}

/** True when the deployment matches every active filter. */
export function matchesDeploymentFilters(
  deployment: DeploymentListItem,
  filters: DeploymentFilters
) {
  if (filters.status !== ALL_FILTER && deployment.status !== filters.status) {
    return false
  }

  if (
    filters.projectId !== ALL_FILTER &&
    deployment.project.id !== filters.projectId
  ) {
    return false
  }

  const term = filters.search.trim().toLowerCase()

  if (!term) {
    return true
  }

  return [
    deployment.project.name,
    deployment.commitMessage ?? "",
    deployment.commitSha,
    deployment.branch,
    `#${deployment.deploymentNumber}`,
  ].some((value) => value.toLowerCase().includes(term))
}

export function filterDeployments(
  deployments: DeploymentListItem[],
  filters: DeploymentFilters
) {
  return deployments.filter((deployment) =>
    matchesDeploymentFilters(deployment, filters)
  )
}
