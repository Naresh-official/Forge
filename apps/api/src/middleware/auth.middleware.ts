import type { Request, Response, NextFunction } from "express"
import { decode } from "next-auth/jwt"
import { apiConfig } from "@workspace/config"
import { ApiError } from "@workspace/types/apiResponses"

const COOKIE_NAME =
    apiConfig.nodeEnv === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token"

export const authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token = req.cookies?.[COOKIE_NAME]

        if (!token) {
            return next(new ApiError(401, "No authentication token provided"))
        }

        const decoded = await decode({
            token,
            secret: apiConfig.authSecret,
            salt: COOKIE_NAME,
        })

        const userId = (decoded as any)?.userId ?? decoded?.sub

        if (!userId) {
            return next(new ApiError(401, "Invalid session token"))
        }

        req.user = {
            id: userId,
            email: decoded?.email ?? "",
        }

        next()
    } catch (error) {
        next(
            new ApiError(
                401,
                "Authentication failed",
                error instanceof Error ? error.stack : ""
            )
        )
    }
}
