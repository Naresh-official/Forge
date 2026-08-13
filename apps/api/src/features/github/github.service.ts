import prisma from "@/utils/db"
import { githubApp } from "./github.client"
import type { GitHubAccountType } from "@/generated/prisma/enums"
import { ApiError } from "@workspace/types/apiResponses"

export const setupGithubAppService = async (installationId: number) => {
    const octokitApp = await githubApp.getInstallationOctokit(installationId)

    const { data: installationData } =
        await octokitApp.rest.apps.getInstallation({
            installation_id: installationId,
        })

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
            installationId: String(installationId),
        },
        create: {
            installationId: String(installationId),
            accountLogin,
            accountType,
        },
        update: {
            accountLogin,
            accountType,
        },
    })

    // update all repositories for this installation or create new ones if not exist
    await prisma.$transaction(
        repositories.repositories.map((repo) =>
            prisma.gitHubRepository.upsert({
                where: {
                    installationId_repositoryId: {
                        installationId: installation.id,
                        repositoryId: String(repo.id),
                    },
                },
                create: {
                    installationId: installation.id,
                    repositoryId: String(repo.id),
                    fullName: repo.full_name,
                    defaultBranch: repo.default_branch ?? "main",
                },
                update: {
                    fullName: repo.full_name,
                    defaultBranch: repo.default_branch ?? "main",
                },
            })
        )
    )
}
