import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import { createUserSchema } from "@forge/types/auth"
import type { UserResponse } from "@forge/types/user"
import type { AuthUser } from "@forge/types"
import { createUserAndAccountService } from "./auth.service"
import { handleErrors } from "@/utils/handleErrors"

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
        handleErrors(res, error)
    }
}

export const meHandler = async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            throw new ApiError(401, "Not authenticated")
        }

        res.status(200).json(
            new ApiResponse<AuthUser>(
                200,
                req.user,
                "User details retrieved successfully"
            )
        )
    } catch (error) {
        handleErrors(res, error)
    }
}
