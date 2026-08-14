import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import { deployRepositoryService } from "./deployment.service"

export const deployRepository = async (req: Request, res: Response) => {
    try {
        const { repoId } = req.params

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
