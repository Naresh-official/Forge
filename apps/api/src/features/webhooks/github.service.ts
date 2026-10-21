import { z } from "zod"
import { ApiError } from "@forge/types/apiResponses"
import { DEFAULT_DEPLOYMENT_RESOURCES } from "@forge/types/deployment"
import prisma from "@/utils/db"
import logger from "@/utils/logger"
import { deployCommitService } from "@/features/deployment/deployment.service"

/**
 * The subset of GitHub's `push` payload the auto-deploy path needs. The
 * payload is third-party input, so it is validated before anything is read
 * from it; unknown fields are ignored.
 */
export const githubPushEventSchema = z.object({
  ref: z.string(),
  /** Head commit SHA after the push. All zeroes means the branch was deleted. */
  after: z.string(),
  deleted: z.boolean().optional(),
  repository: z.object({
    id: z.number().int(),
    full_name: z.string(),
  }),
  head_commit: z
    .object({
      id: z.string(),
      message: z.string(),
    })
    .nullish(),
})

export type GithubPushEvent = z.infer<typeof githubPushEventSchema>

export type GithubPushResult =
  | {
      status: "queued"
      projectId: string
      deploymentId: string
      deploymentNumber: number
      branch: string
      commitSha: string
    }
  | { status: "ignored"; reason: string }

/** GitHub sends this SHA when the pushed ref was deleted. */
const ZERO_SHA = /^0+$/

/**
 * Turns a GitHub `push` event into a deployment for the project that owns the
 * repository.
 *
 * Only pushes to the branch the project deploys (the latest deployment's
 * branch, falling back to the repository's default branch) are deployed, so a
 * feature-branch push cannot roll production back. Deliveries are
 * idempotent: a push whose head commit is already the latest deployment is
 * ignored, which also makes GitHub's retries harmless.
 *
 * Once the new deployment reports READY, the API cancels the older ones (see
 * `completeDeploymentService`), so only the newest commit keeps serving.
 */
export const handleGithubPushEvent = async (
  event: GithubPushEvent
): Promise<GithubPushResult> => {
  if (event.deleted || ZERO_SHA.test(event.after)) {
    return { status: "ignored", reason: "branch was deleted" }
  }

  if (!event.ref.startsWith("refs/heads/")) {
    return { status: "ignored", reason: "push is not for a branch" }
  }

  const branch = event.ref.slice("refs/heads/".length)

  const repository = await prisma.gitHubRepository.findFirst({
    where: {
      id: event.repository.id,
      fullName: event.repository.full_name,
    },
    select: {
      defaultBranch: true,
      project: {
        select: {
          id: true,
          status: true,
          userId: true,
          deployments: {
            orderBy: { deploymentNumber: "desc" },
            take: 1,
            select: {
              commitSha: true,
              branch: true,
              resources: {
                select: {
                  cpuMillicores: true,
                  memoryMb: true,
                  ephemeralStorageMb: true,
                  autoscalingEnabled: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!repository?.project) {
    return {
      status: "ignored",
      reason: "repository is not linked to a project",
    }
  }

  const project = repository.project

  if (project.status !== "ACTIVE") {
    return { status: "ignored", reason: `project ${project.id} is paused` }
  }

  const latest = project.deployments[0]
  const deployedBranch = latest?.branch ?? repository.defaultBranch

  if (branch !== deployedBranch) {
    return {
      status: "ignored",
      reason: `push is for "${branch}", the project deploys "${deployedBranch}"`,
    }
  }

  if (latest?.commitSha === event.after) {
    return {
      status: "ignored",
      reason: `commit ${event.after} is already the latest deployment`,
    }
  }

  const resources = latest?.resources ?? DEFAULT_DEPLOYMENT_RESOURCES

  try {
    const created = await deployCommitService({
      projectId: project.id,
      createdByUserId: project.userId,
      commitSha: event.after,
      commitMessage: event.head_commit?.message ?? null,
      branch,
      resources: {
        cpuMillicores: resources.cpuMillicores,
        memoryMb: resources.memoryMb,
        ephemeralStorageMb: resources.ephemeralStorageMb,
        autoscalingEnabled: resources.autoscalingEnabled,
      },
    })

    logger.info(
      {
        projectId: project.id,
        deploymentId: created.deploymentId,
        deploymentNumber: created.deploymentNumber,
        branch,
        commitSha: event.after,
      },
      "GitHub push queued a deployment"
    )

    return {
      status: "queued",
      projectId: project.id,
      deploymentId: created.deploymentId,
      deploymentNumber: created.deploymentNumber,
      branch,
      commitSha: event.after,
    }
  } catch (error) {
    /*
     * A concurrent delivery (or a manual deploy) may have claimed the next
     * deployment number between our read and the insert. That is not a
     * failure the webhook should retry — the newer commit is already being
     * deployed.
     */
    if (error instanceof ApiError && error.statusCode === 409) {
      return {
        status: "ignored",
        reason: "another deployment is already starting for this project",
      }
    }

    throw error
  }
}
