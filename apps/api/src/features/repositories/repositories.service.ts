import prisma from "@/utils/db"

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
