import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import type { ProjectResourcesResponse } from "@forge/types/resources"
import { handleErrors } from "@/utils/handleErrors"
import { getProjectResourcesService } from "./resources.service"

/** The router is mounted under `/projects/:projectId/resources`. */
export const getProjectResources = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const resources = await getProjectResourcesService(
      req.params.projectId as string,
      userId
    )

    return res
      .status(200)
      .json(
        new ApiResponse<ProjectResourcesResponse>(
          200,
          resources,
          "Project resources fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}
