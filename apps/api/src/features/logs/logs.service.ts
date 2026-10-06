import prisma from "@/utils/db"
import { isUuid } from "@/utils/uuid"
import { ApiError } from "@forge/types/apiResponses"
import { apiConfig } from "@forge/config"
import { createLogsStorageClient, getDeploymentLogs } from "@forge/logs/s3"
import type { GetDeploymentLogsResponse } from "@forge/types/logs"

/**
 * Ownership check for every log endpoint: a deployment is only accessible
 * through its project, and a project only through its owner.
 */
export async function assertDeploymentAccess(
  deploymentId: string,
  userId: string
): Promise<{ projectId: string }> {
  if (!isUuid(deploymentId)) {
    throw new ApiError(404, "Deployment not found.")
  }

  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: {
      projectId: true,
      project: {
        select: {
          userId: true,
        },
      },
    },
  })

  if (!deployment) {
    throw new ApiError(404, "Deployment not found.")
  }

  if (deployment.project.userId !== userId) {
    // Do not leak existence — respond the same as for a missing deployment.
    throw new ApiError(404, "Deployment not found.")
  }

  return { projectId: deployment.projectId }
}

const storage = createLogsStorageClient({
  bucket: apiConfig.logs.bucket,
  region: apiConfig.logs.region,
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
  ...(process.env.S3_FORCE_PATH_STYLE === "true"
    ? { forcePathStyle: true }
    : {}),
})

export interface GetDeploymentLogsInput {
  deploymentId: string
  userId: string
  /** "build" or "runtime". */
  type: "build" | "runtime"
  /** S3 continuation token from a previous page. */
  cursor?: string
}

/**
 * Loads one bounded page of persisted logs from S3. Memory use is capped:
 * only `apiConfig.logs.listPageSize` chunk objects are read per request.
 */
export async function getDeploymentLogsService(
  input: GetDeploymentLogsInput
): Promise<GetDeploymentLogsResponse> {
  const { projectId } = await assertDeploymentAccess(
    input.deploymentId,
    input.userId
  )

  try {
    return await getDeploymentLogs({
      client: storage,
      bucket: apiConfig.logs.bucket,
      projectId,
      deploymentId: input.deploymentId,
      kind: input.type,
      pageSize: apiConfig.logs.listPageSize,
      continuationToken: input.cursor,
    })
  } catch (error) {
    // Missing bucket / network problems must not 500 the whole dashboard —
    // an empty log page keeps the UI usable while the pipeline recovers.
    if (!input.cursor) {
      return {
        deploymentId: input.deploymentId,
        type: input.type,
        chunks: [],
        lines: [],
        hasMore: false,
      }
    }

    throw error
  }
}
