import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import { deployRepositoryService } from "./deployment.service"
import { createRepositorySchema } from "@forge/types"

export const deployRepository = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id
        const input = createRepositorySchema.parse(req.body)

        if (!userId) {
            throw new ApiError(401, "Unauthorized")
        }

        const build = await deployRepositoryService(input, userId)

        return res
            .status(200)
            .json(
                new ApiResponse(200, build, "Deployment initiated successfully")
            )
    } catch (error) {
        handleErrors(res, error)
    }
}
