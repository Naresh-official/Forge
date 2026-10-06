import type { Request, Response } from "express"
import {
  deleteProjectService,
  listAllProjectsService,
  listProjectDeploymentsService,
  listProjectNamesService,
  renameProjectService,
  setProjectStatusService,
} from "./projects.service"
import { handleErrors } from "@/utils/handleErrors"
import {
  ApiResponse,
  renameProjectSchema,
  setProjectStatusSchema,
  type ListProjectDeploymentsResponse,
  type ListProjectNamesResponse,
  type ListProjectsResponse,
  type ProjectSettingsResponse,
} from "@forge/types"
import { ApiError } from "@forge/types/apiResponses"

export const listAllProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!
    const projects = await listAllProjectsService(userId)

    return res
      .status(200)
      .json(
        new ApiResponse<ListProjectsResponse>(
          200,
          projects,
          "Projects fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const listProjectNames = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!
    const projects = await listProjectNamesService(userId)

    return res
      .status(200)
      .json(
        new ApiResponse<ListProjectNamesResponse>(
          200,
          projects,
          "Project names fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const listProjectDeployments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id!
    // The route guarantees a single string segment.
    const projectId = req.params.projectId as string

    const deployments = await listProjectDeploymentsService(projectId, userId)

    return res
      .status(200)
      .json(
        new ApiResponse<ListProjectDeploymentsResponse>(
          200,
          deployments,
          "Deployments fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const renameProject = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const { name } = renameProjectSchema.parse(req.body)
    const projectId = req.params.projectId as string

    const project = await renameProjectService(projectId, userId, name)

    return res
      .status(200)
      .json(
        new ApiResponse<ProjectSettingsResponse>(
          200,
          project,
          "Project renamed successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const setProjectStatus = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const { status } = setProjectStatusSchema.parse(req.body)
    const projectId = req.params.projectId as string

    const project = await setProjectStatusService(projectId, userId, status)

    return res
      .status(200)
      .json(
        new ApiResponse<ProjectSettingsResponse>(
          200,
          project,
          status === "PAUSED"
            ? "Project paused successfully"
            : "Project resumed successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

export const deleteProject = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const projectId = req.params.projectId as string
    const result = await deleteProjectService(projectId, userId)

    return res
      .status(200)
      .json(
        new ApiResponse<{ id: string }>(
          200,
          result,
          "Project deleted successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}
