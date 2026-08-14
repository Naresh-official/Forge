import { builder } from "@/clients/builder.client"
import prisma from "@/utils/db"
import { ApiError } from "@forge/types/apiResponses"

export const deployRepositoryService = async (repositoryId: string) => {
    const repository = await prisma.gitHubRepository.findFirst({
        where: { repositoryId },
    })

    if (!repository) {
        throw new ApiError(404, "Repository not found.")
    }

    const result = await new Promise((resolve, reject) => {
        builder.client.build(
            {
                projectId: repository.projectId!,
            },
            (error, response) => {
                if (error) {
                    reject(error)
                    return
                }

                resolve(response)
            }
        )
    })

    return result
}
