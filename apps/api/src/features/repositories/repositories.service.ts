import prisma from "@/utils/db"
import { ApiError } from "@workspace/types/apiResponses"

export const getAvailableRepositoriesService = async (userId: string) => {
    const repositories = await prisma.gitHubRepository.findMany({
        where: {
            installation: { userId },
        },
        include: {
            installation: false,
        },
    })

    return repositories
}

export const deployRepositoryService = async (repositoryId: string) => {
    const repository = await prisma.gitHubRepository.findFirst({
        where: { repositoryId },
    })

    if (!repository) {
        throw new ApiError(404, "Repository not found.")
    }

    return {
        repositoryId: repository.repositoryId,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
        status: "QUEUED",
    }
}
