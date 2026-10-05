import type { Request, Response } from "express"
import {
  listAllProjectsService,
  listProjectNamesService,
} from "./projects.service"
import { handleErrors } from "@/utils/handleErrors"
import {
  ApiResponse,
  type ListProjectNamesResponse,
  type ListProjectsResponse,
} from "@forge/types"

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
