import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@workspace/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import {
    getAvailableRepositoriesService,
    deployRepositoryService,
} from "./repositories.service"

export const listRepositories = async (req: Request, res: Response) => {
    try {
        const repositories = await getAvailableRepositoriesService(req.user!.id)

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    repositories,
                    "Repositories retrieved successfully"
                )
            )
    } catch (error) {
        handleErrors(res, error)
    }
}

export const deployRepository = async (req: Request, res: Response) => {
    try {
        const { repoId } = req.body

        if (!repoId) {
            throw new ApiError(400, "Missing repoId")
        }

        const deployment = await deployRepositoryService(String(repoId))

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    deployment,
                    "Deployment initiated successfully"
                )
            )
    } catch (error) {
        handleErrors(res, error)
    }
}
