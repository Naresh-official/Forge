import { apiConfig } from "@forge/config"
import { ApiError } from "@forge/types/apiResponses"
import type { Response } from "express"
import z, { ZodError } from "zod"

export function handleErrors(res: Response, error: unknown) {
    if (apiConfig.nodeEnv === "development") {
        console.log(error)
    }

    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            success: error.success,
            message: error.message,
            data: error.data,
        })
    }

    if (error instanceof ZodError) {
        const errorMessage = error.issues
            .map((issue) => {
                const field = issue.path.join(".")
                return `${field}: ${issue.message}`
            })
            .join(", ")

        return res.status(400).json({
            success: false,
            message: errorMessage,
            data: null,
        })
    }

    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        data: null,
    })
}
