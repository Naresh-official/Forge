import type { Request, Response } from "express"
import { apiConfig } from "@forge/config/api"
import { setupGithubAppService } from "./github.service"
import { ApiError } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"

export const redirectToInstallationPage = async (
    req: Request,
    res: Response
) => {
    const appSlug = apiConfig.github.appSlug

    if (!appSlug) {
        return res.status(500).json({
            message: "GitHub App is not configured",
        })
    }

    return res.redirect(`https://github.com/apps/${appSlug}/installations/new`)
}

export const githubSetup = async (req: Request, res: Response) => {
    try {
        const installationId = req.query.installation_id

        if (!installationId) {
            return res.status(400).json({
                message: "Missing installation_id",
            })
        }

        await setupGithubAppService(Number(installationId), req.user!.id)

        return res.json({
            message: "GitHub App installed successfully",
        })
    } catch (error) {
        if (apiConfig.nodeEnv === "development") console.log(error)
        if (error instanceof ApiError) {
            res.status(error.statusCode).json(
                new ApiError(error.statusCode, error.message, error.stack)
            )
        } else {
            handleErrors(res, error)
        }
    }
}
