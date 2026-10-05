import prisma from "@/utils/db"
import { githubApp } from "./github.client"
import type { Framework, GitHubAccountType } from "@/generated/prisma/enums"
import { ApiError } from "@forge/types/apiResponses"
import { detectFramework } from "@forge/frameworks"
import type { Octokit } from "octokit"

/** The subset of a GitHub repository payload the sync actually needs. */
export type AccessibleRepository = {
  id: number
  full_name: string
  default_branch?: string | null
}

function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: number }).status === 404
  )
}

/**
 * Reads the repository's package.json through the GitHub Contents API and
 * detects the framework.
 *
 * Returns:
 * - a `Framework` when detection succeeded (including UNKNOWN when there is
 *   no package.json or no supported framework),
 * - `null` when the lookup failed transiently, so the next sync retries it.
 */
async function detectRepositoryFramework(
  octokit: Octokit,
  fullName: string
): Promise<Framework | null> {
  const [owner, repo] = fullName.split("/")

  if (!owner || !repo) {
    return null
  }

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: "package.json",
    })

    // A path pointing at a directory (or a symlink) has no inline content.
    if (Array.isArray(data) || !("content" in data) || !data.content) {
      return "UNKNOWN"
    }

    const packageJson = JSON.parse(
      Buffer.from(data.content, "base64").toString("utf8")
    )

    return detectFramework(packageJson).toUpperCase() as Framework
  } catch (error) {
    // No package.json → nothing to detect.
    if (isNotFoundError(error)) {
      return "UNKNOWN"
    }

    return null
  }
}

/**
 * Mirrors the repositories GitHub reports for an installation into the
 * database: new and renamed repositories are created/updated, and
 * repositories the installation can no longer access are removed.
 *
 * When an `octokit` is supplied, repositories whose framework has not been
 * detected yet (framework is still null) are inspected once and the detected
 * value is stored on the repository.
 *
 * Repositories that are already attached to a project are never removed —
 * an import has to keep working even if the GitHub App loses access to the
 * repository later.
 */
export const syncInstallationRepositories = async (
  installationId: number,
  repositories: AccessibleRepository[],
  octokit?: Octokit
) => {
  const existing = await prisma.gitHubRepository.findMany({
    where: { installationId },
    select: { id: true, framework: true },
  })

  const detectedFrameworks = new Map<number, Framework | null>()

  if (octokit) {
    const existingById = new Map(
      existing.map((repo) => [repo.id, repo.framework])
    )

    const pendingDetection = repositories.filter(
      (repo) => (existingById.get(repo.id) ?? null) === null
    )

    await Promise.all(
      pendingDetection.map(async (repo) => {
        detectedFrameworks.set(
          repo.id,
          await detectRepositoryFramework(octokit, repo.full_name)
        )
      })
    )
  }

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
          framework: detectedFrameworks.get(repo.id) ?? null,
        },
        update: {
          fullName: repo.full_name,
          defaultBranch: repo.default_branch ?? "main",
          ...(detectedFrameworks.has(repo.id)
            ? { framework: detectedFrameworks.get(repo.id) ?? null }
            : {}),
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

  await syncInstallationRepositories(
    installation.id,
    repositories.repositories,
    octokitApp
  )
}
