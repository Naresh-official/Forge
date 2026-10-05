import prisma from "@/utils/db"
import { githubApp } from "@/features/github/github.client"
import { syncInstallationRepositories } from "@/features/github/github.service"

/**
 * Repositories the user is allowed to deploy.
 *
 * The list is refreshed from GitHub on every read so it always reflects the
 * repositories the installation can currently access, then served from the
 * local copy that carries the `projectId` link back to imported projects.
 */
export const getAvailableRepositoriesService = async (userId: string) => {
  const installations = await prisma.gitHubInstallation.findMany({
    where: { userId },
  })

  for (const installation of installations) {
    try {
      const octokit = await githubApp.getInstallationOctokit(installation.id)

      const repositories = await octokit.paginate(
        octokit.rest.apps.listReposAccessibleToInstallation,
        { per_page: 100 }
      )

      await syncInstallationRepositories(installation.id, repositories)
    } catch (error) {
      /*
       * One unusable installation (revoked, suspended, …) should not take
       * the whole page down — log it and serve whatever we have locally.
       */
      console.error(
        `Failed to sync repositories for installation ${installation.id}:`,
        error
      )
    }
  }

  return prisma.gitHubRepository.findMany({
    where: {
      installation: { userId },
    },
  })
}
