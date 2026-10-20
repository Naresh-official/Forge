import type { Request, Response } from "express"
import { ApiError, ApiResponse } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import {
  deployRepositoryService,
  getDeploymentService,
  listDeploymentsService,
  redeployDeploymentService,
} from "./deployment.service"
import {
  createRepositorySchema,
  type DeploymentDetailResponse,
  type ListDeploymentsResponse,
  type RedeployProjectResponse,
} from "@forge/types"

export const deployRepository = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id
    const input = createRepositorySchema.parse(req.body)

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const build = await deployRepositoryService(input, userId)

    return res
      .status(200)
      .json(new ApiResponse(200, build, "Deployment initiated successfully"))
  } catch (error) {
    handleErrors(res, error)
  }
}

/** Every deployment of every project the caller owns, newest first. */
export const listDeployments = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const deployments = await listDeploymentsService(userId)

    return res
      .status(200)
      .json(
        new ApiResponse<ListDeploymentsResponse>(
          200,
          deployments,
          "Deployments fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

/** One deployment, with the project, build and resource plan. */
export const getDeployment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const deployment = await getDeploymentService(
      req.params.deploymentId as string,
      userId
    )

    return res
      .status(200)
      .json(
        new ApiResponse<DeploymentDetailResponse>(
          200,
          deployment,
          "Deployment fetched successfully"
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}

/** Rebuilds this deployment's commit as a new deployment. */
export const redeployDeployment = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const deployment = await redeployDeploymentService(
      req.params.deploymentId as string,
      userId
    )

    return res
      .status(201)
      .json(
        new ApiResponse<RedeployProjectResponse>(
          201,
          deployment,
          `Deployment #${deployment.deploymentNumber} queued`
        )
      )
  } catch (error) {
    handleErrors(res, error)
  }
}
