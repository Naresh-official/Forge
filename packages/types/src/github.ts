export type GithubSetUpBody = {
  installation: {
    id: string
    account: {
      login: string
      type: string
    }
  }
  repositories: [
    {
      id: string
      full_name: string
    },
  ]
}

/**
 * A repository made available to the user through their GitHub App
 * installation. Mirrors the `GitHubRepository` Prisma model.
 */
export type GithubRepository = {
  id: number
  installationId: number
  /** Set once the repository has been imported as a project. */
  projectId: string | null
  fullName: string
  defaultBranch: string
  /** ISO timestamp — serialised over HTTP, not a Date instance. */
  createdAt: string
}

export type ListRepositoriesResponse = GithubRepository[]
