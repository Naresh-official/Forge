import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@workspace/types/apiResponses"
import { createUserSchema } from "@workspace/types/auth"
import type { UserResponse } from "@workspace/types/user"
import { createUserAndAccountService } from "./auth.service"
import { apiConfig } from "@workspace/config"

export const githubAuthHandler = async (req: Request, res: Response) => {
    try {
        const input = await createUserSchema.parseAsync(req.body)

        const user = await createUserAndAccountService(input)

        res.status(201).json(
            new ApiResponse<UserResponse>(
                201,
                user,
                "User created successfully"
            )
        )
    } catch (error) {
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
}
