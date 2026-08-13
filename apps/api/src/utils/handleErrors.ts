import { apiConfig } from "@workspace/config"
import { ApiError } from "@workspace/types/apiResponses"
import type { Response } from "express"

export function handleErrors(res: Response, error: any) {
    if (apiConfig.nodeEnv === "development") console.log(error)
    if (error instanceof ApiError) {
        res.status(error.statusCode).json(
            new ApiError(error.statusCode, error.message, error.stack)
        )
    } else {
        res.status(500).json(
            new ApiError(
                500,
                "Internal Server Error",
                error instanceof Error ? error.stack : ""
            )
        )
    }
}
