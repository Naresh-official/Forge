import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import {
  createProjectEnvironmentVariableSchema,
  projectEnvironmentVariableKeySchema,
  updateProjectEnvironmentVariableSchema,
  type CreateProjectEnvironmentVariableResponse,
  type DeleteProjectEnvironmentVariableResponse,
  type ListProjectEnvironmentVariablesResponse,
  type UpdateProjectEnvironmentVariableResponse,
} from "@forge/types/environment"
import { handleErrors } from "@/utils/handleErrors"
import {
  createEnvironmentVariableService,
  deleteEnvironmentVariableService,
  listEnvironmentVariablesService,
  updateEnvironmentVariableService,
} from "./environment.service"

/** The router is mounted under `/projects/:projectId/environment-variables`. */
function projectIdOf(req: Request) {
  return req.params.projectId as string
}

export const listEnvironmentVariables = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const variables = await listEnvironmentVariablesService(
      projectIdOf(req),
      userId
    )

    return res
      .status(200)
      .json(
        new ApiResponse<ListProjectEnvironmentVariablesResponse>(
          200,
          variables,
          "Environment variables fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const createEnvironmentVariable = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const input = createProjectEnvironmentVariableSchema.parse(req.body)
    const result = await createEnvironmentVariableService(
      projectIdOf(req),
      userId,
      input
    )

    return res
      .status(201)
      .json(
        new ApiResponse<CreateProjectEnvironmentVariableResponse>(
          201,
          result,
          `Environment variable "${result.variable.key}" saved`
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const updateEnvironmentVariable = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const key = projectEnvironmentVariableKeySchema.parse(req.params.key)
    const input = updateProjectEnvironmentVariableSchema.parse(req.body)

    const result = await updateEnvironmentVariableService(
      projectIdOf(req),
      userId,
      key,
      input
    )

    return res
      .status(200)
      .json(
        new ApiResponse<UpdateProjectEnvironmentVariableResponse>(
          200,
          result,
          `Environment variable "${key}" updated`
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const deleteEnvironmentVariable = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const key = projectEnvironmentVariableKeySchema.parse(req.params.key)
    const result = await deleteEnvironmentVariableService(
      projectIdOf(req),
      userId,
      key
    )

    return res
      .status(200)
      .json(
        new ApiResponse<DeleteProjectEnvironmentVariableResponse>(
          200,
          result,
          `Environment variable "${key}" deleted`
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}
