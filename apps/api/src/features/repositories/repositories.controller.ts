import type { Request, Response } from "express"
import { ApiResponse } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import { getAvailableRepositoriesService } from "./repositories.service"

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
