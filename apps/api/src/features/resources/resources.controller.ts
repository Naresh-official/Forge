import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import {
  updateProjectResourcesSchema,
  type ProjectResourcesResponse,
  type ProjectResourceSettings,
} from "@forge/types/resources"
import { handleErrors } from "@/utils/handleErrors"
import {
  getProjectResourcesService,
  updateProjectResourcesService,
} from "./resources.service"

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

/**
 * PATCH /projects/:projectId/resources
 *
 * Changes the project's resource plan and autoscaling setting. Persists to the
 * project's current deployment and asks the deployer to resize the running
 * workload; a deployer failure is reported as a warning, not an error.
 */
export const updateProjectResources = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const input = updateProjectResourcesSchema.parse(req.body)

    const settings = await updateProjectResourcesService(
      req.params.projectId as string,
      userId,
      input
    )

    return res
      .status(200)
      .json(
        new ApiResponse<ProjectResourceSettings>(
          200,
          settings,
          settings.applied
            ? "Resource plan updated and applied"
            : "Resource plan updated"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}
