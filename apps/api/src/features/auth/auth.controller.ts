import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@workspace/types/apiResponses"
import { createUserSchema } from "@workspace/types/auth"
import type { UserResponse } from "@workspace/types/user"
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
