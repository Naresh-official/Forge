import prisma from "@/utils/db"
import { githubApp } from "./github.client"
import type { GitHubAccountType } from "@/generated/prisma/enums"
import { ApiError } from "@forge/types/apiResponses"

/** The subset of a GitHub repository payload the sync actually needs. */
export type AccessibleRepository = {
  id: number
  full_name: string
  default_branch?: string | null
}

/**
 * Mirrors the repositories GitHub reports for an installation into the
 * database: new and renamed repositories are created/updated, and
 * repositories the installation can no longer access are removed.
 *
 * Repositories that are already attached to a project are never removed —
 * an import has to keep working even if the GitHub App loses access to the
 * repository later.
 */
export const syncInstallationRepositories = async (
  installationId: number,
  repositories: AccessibleRepository[]
) => {
  await prisma.$transaction([
    ...repositories.map((repo) =>
      prisma.gitHubRepository.upsert({
        where: {
          installationId_id: {
            installationId,
            id: repo.id,
          },
        },
        create: {
          installationId,
          id: repo.id,
          fullName: repo.full_name,
          defaultBranch: repo.default_branch ?? "main",
        },
        update: {
          fullName: repo.full_name,
          defaultBranch: repo.default_branch ?? "main",
        },
      })
    ),
    prisma.gitHubRepository.deleteMany({
      where: {
        installationId,
        projectId: null,
        id: { notIn: repositories.map((repo) => repo.id) },
      },
    }),
  ])
}

export const setupGithubAppService = async (
  installationId: number,
  userId: string
) => {
  const octokitApp = await githubApp.getInstallationOctokit(installationId)

  const { data: installationData } = await octokitApp.rest.apps.getInstallation(
    {
      installation_id: installationId,
    }
  )

  const { data: repositories } =
    await octokitApp.rest.apps.listReposAccessibleToInstallation({
      per_page: 100,
    })

  const account = installationData.account

  if (!account) {
    throw new ApiError(400, "GitHub installation account is missing.")
  }

  let accountLogin: string
  let accountType: GitHubAccountType

  if ("login" in account) {
    accountLogin = account.login
    const type = (account as any).type?.toUpperCase()
    accountType = type === "ORGANIZATION" ? "ORGANIZATION" : "USER"
  } else if ("slug" in account) {
    accountLogin = account.slug
    accountType = "ORGANIZATION"
  } else {
    throw new ApiError(400, "Could not determine GitHub account details")
  }

  const installation = await prisma.gitHubInstallation.upsert({
    where: {
      id: installationId,
    },
    create: {
      id: installationId,
      accountLogin,
      accountType,
      user: {
        connect: { id: userId },
      },
    },
    update: {
      accountLogin,
      accountType,
    },
  })

  await syncInstallationRepositories(installation.id, repositories.repositories)
}
