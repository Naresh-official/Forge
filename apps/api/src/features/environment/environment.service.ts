import prisma from "@/utils/db"
import { isUuid } from "@/utils/uuid"
import { ApiError } from "@forge/types/apiResponses"
import {
  decryptEnvVariables,
  encryptEnvValue,
  isEnvValueReadable,
} from "@/utils/encryption"
import {
  isStaticFramework,
  normalizeFramework,
  type Framework,
} from "@forge/frameworks"
import { startBuildWrapper } from "@/gRPC/wrapper/builder.wrapper"
import { syncEnvironmentVariablesWrapper } from "@/gRPC/wrapper/deployer.wrapper"
import type {
  CreateProjectEnvironmentVariableInput,
  EnvironmentChange,
  UpdateProjectEnvironmentVariableInput,
} from "@forge/types/environment"

/** Upper bound on running deployments a single change is pushed to. */
const MAX_SYNCED_DEPLOYMENTS = 10

const VARIABLE_FIELDS = {
  key: true,
  isSecret: true,
  createdAt: true,
  updatedAt: true,
} as const

/** Fields needed to report whether a stored value is still decryptable. */
const LIST_FIELDS = { ...VARIABLE_FIELDS, valueEncrypted: true } as const

/** Ownership-scoped lookup — a project the caller does not own reads as missing. */
async function findOwnedProjectOrThrow(projectId: string, userId: string) {
  if (!isUuid(projectId)) {
    throw new ApiError(404, "Project not found.")
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    include: { githubRepository: { select: { framework: true } } },
  })

  if (!project) {
    throw new ApiError(404, "Project not found.")
  }

  return project
}

/**
 * A project's variables — keys and metadata only. Values are encrypted at
 * rest and deliberately never leave the API in plaintext.
 */
export const listEnvironmentVariablesService = async (
  projectId: string,
  userId: string
) => {
  await findOwnedProjectOrThrow(projectId, userId)

  const stored = await prisma.environmentVariable.findMany({
    where: { projectId },
    orderBy: { key: "asc" },
    select: LIST_FIELDS,
  })

  /*
   * The ciphertext is read only to report whether the row is still readable
   * with the current key; it never leaves the API. A row that cannot be
   * decrypted stays visible so the user can replace its value.
   */
  return stored.map(({ valueEncrypted, ...variable }) => ({
    ...variable,
    readable: isEnvValueReadable(valueEncrypted),
  }))
}

export const createEnvironmentVariableService = async (
  projectId: string,
  userId: string,
  input: CreateProjectEnvironmentVariableInput
) => {
  await findOwnedProjectOrThrow(projectId, userId)

  const existing = await prisma.environmentVariable.findUnique({
    where: { projectId_key: { projectId, key: input.key } },
    select: { id: true },
  })

  if (existing) {
    throw new ApiError(
      409,
      `Environment variable "${input.key}" already exists.`
    )
  }

  const variable = await prisma.environmentVariable.create({
    data: {
      projectId,
      key: input.key,
      valueEncrypted: encryptEnvValue(input.value),
      isSecret: true,
    },
    select: VARIABLE_FIELDS,
  })

  const change = await applyEnvironmentChange(projectId, userId)

  // Just written with the current key, so it is readable by construction.
  return { variable: { ...variable, readable: true }, change }
}

export const updateEnvironmentVariableService = async (
  projectId: string,
  userId: string,
  key: string,
  input: UpdateProjectEnvironmentVariableInput
) => {
  await findOwnedProjectOrThrow(projectId, userId)

  const existing = await prisma.environmentVariable.findUnique({
    where: { projectId_key: { projectId, key } },
    select: { id: true },
  })

  if (!existing) {
    throw new ApiError(404, `Environment variable "${key}" not found.`)
  }

  const variable = await prisma.environmentVariable.update({
    where: { id: existing.id },
    data: { valueEncrypted: encryptEnvValue(input.value) },
    select: VARIABLE_FIELDS,
  })

  const change = await applyEnvironmentChange(projectId, userId)

  // Re-encrypted with the current key, which also repairs an unreadable row.
  return { variable: { ...variable, readable: true }, change }
}

export const deleteEnvironmentVariableService = async (
  projectId: string,
  userId: string,
  key: string
) => {
  await findOwnedProjectOrThrow(projectId, userId)

  const existing = await prisma.environmentVariable.findUnique({
    where: { projectId_key: { projectId, key } },
    select: { id: true },
  })

  if (!existing) {
    throw new ApiError(404, `Environment variable "${key}" not found.`)
  }

  await prisma.environmentVariable.delete({ where: { id: existing.id } })

  const change = await applyEnvironmentChange(projectId, userId)

  return { key, change }
}

/**
 * Makes a persisted environment change take effect:
 *
 * - **Static projects** are rebuilt. A new deployment + build is queued; the
 *   builder uploads to a fresh `<projectId>/<deploymentId>/` prefix and the
 *   previous artifacts are pruned once that build succeeds.
 * - **Container projects** get their Kubernetes env Secret rewritten in each
 *   running deployment's namespace, and the workload is rolled so pods pick
 *   the new values up.
 *
 * The variable itself is already saved, so propagation failures are reported
 * as warnings instead of failing the request.
 */
async function applyEnvironmentChange(
  projectId: string,
  userId: string
): Promise<EnvironmentChange> {
  const project = await findOwnedProjectOrThrow(projectId, userId)

  const latest = await prisma.deployment.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { resources: true },
  })

  if (!latest) {
    return {
      action: "NONE",
      deploymentId: null,
      buildId: null,
      syncedDeployments: 0,
      warnings: [],
    }
  }

  const target = decideEnvironmentChange({
    artifactKey: latest.artifactKey,
    imageUrl: latest.imageUrl,
    framework: normalizeFramework(project.githubRepository?.framework),
  })

  if (target === "REBUILD") {
    const rebuild = await rebuildStaticProject(projectId, userId, latest)

    return {
      action: "REBUILD",
      deploymentId: rebuild.deploymentId,
      buildId: rebuild.buildId,
      syncedDeployments: 0,
      warnings: rebuild.warnings,
    }
  }

  if (target === "SECRET_SYNC") {
    return syncRunningDeployments(projectId)
  }

  return {
    action: "NONE",
    deploymentId: null,
    buildId: null,
    syncedDeployments: 0,
    warnings: [],
  }
}

/**
 * Where a persisted environment change has to be applied.
 *
 * A deployment's stored output says which plane it lives on: a static build
 * has an artifact prefix, a container build has an image. When neither exists
 * (e.g. the first deploy failed) the detected framework decides. Pure, so the
 * routing is testable without a database.
 */
export function decideEnvironmentChange(input: {
  artifactKey: string | null
  imageUrl: string | null
  framework: Framework
}): "REBUILD" | "SECRET_SYNC" | "NONE" {
  if (input.artifactKey !== null) {
    return "REBUILD"
  }

  if (input.imageUrl !== null) {
    return "SECRET_SYNC"
  }

  return isStaticFramework(input.framework) ? "REBUILD" : "NONE"
}

type PreviousDeployment = {
  deploymentNumber: number
  commitSha: string
  commitMessage: string | null
  branch: string
  resources: {
    cpuMillicores: number
    memoryMb: number
    ephemeralStorageMb: number
    autoscalingEnabled: boolean
  } | null
}

/**
 * Queues a rebuild of the project's current source (same commit) under a new
 * deployment number, so the builder re-runs install/build with the new
 * variables and stores the output under its own S3 prefix.
 */
async function rebuildStaticProject(
  projectId: string,
  userId: string,
  previous: PreviousDeployment
): Promise<{
  deploymentId: string | null
  buildId: string | null
  warnings: string[]
}> {
  const { deployment, build } = await prisma.$transaction(async (tx) => {
    const createdDeployment = await tx.deployment.create({
      data: {
        projectId,
        deploymentNumber: previous.deploymentNumber + 1,
        commitSha: previous.commitSha,
        commitMessage: previous.commitMessage,
        branch: previous.branch,
        status: "QUEUED",
        createdByUserId: userId,
        ...(previous.resources
          ? {
              resources: {
                create: {
                  cpuMillicores: previous.resources.cpuMillicores,
                  memoryMb: previous.resources.memoryMb,
                  ephemeralStorageMb: previous.resources.ephemeralStorageMb,
                  autoscalingEnabled: previous.resources.autoscalingEnabled,
                },
              },
            }
          : {}),
      },
      select: { id: true },
    })

    /*
     * The build is created separately rather than nested so this works
     * against both the one-build-per-deployment schema and the multi-build
     * variant, without depending on the relation's name.
     */
    const createdBuild = await tx.build.create({
      data: { deploymentId: createdDeployment.id, status: "QUEUED" },
      select: { id: true },
    })

    return { deployment: createdDeployment, build: createdBuild }
  })

  try {
    await startBuildWrapper({ buildId: build.id })
  } catch (error) {
    console.error("Failed to forward rebuild to builder:", error)

    /*
     * No BuildStarted will ever arrive, so fail both rows instead of leaving
     * them stuck in QUEUED (same reasoning as the initial deploy path).
     */
    await prisma.$transaction([
      prisma.build.update({
        where: { id: build.id },
        data: { status: "FAILED", completedAt: new Date() },
      }),
      prisma.deployment.update({
        where: { id: deployment.id },
        data: { status: "FAILED", completedAt: new Date() },
      }),
    ])

    return {
      deploymentId: deployment.id,
      buildId: build.id,
      warnings: [
        "The rebuild could not be started — the builder is unreachable.",
      ],
    }
  }

  return { deploymentId: deployment.id, buildId: build.id, warnings: [] }
}

/**
 * Rewrites the env Secret of every running (container) deployment of the
 * project. The API is the only service that can decrypt the values, so the
 * plaintext set is pushed over the internal gRPC channel.
 */
async function syncRunningDeployments(
  projectId: string
): Promise<EnvironmentChange> {
  const deployments = await prisma.deployment.findMany({
    where: { projectId, imageUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    take: MAX_SYNCED_DEPLOYMENTS,
    select: { id: true },
  })

  if (deployments.length === 0) {
    return {
      action: "NONE",
      deploymentId: null,
      buildId: null,
      syncedDeployments: 0,
      warnings: [],
    }
  }
  const stored = await prisma.environmentVariable.findMany({
    where: { projectId },
    select: { key: true, valueEncrypted: true },
  })

  /*
   * Decryption happens before the call so a missing key surfaces as a server
   * error rather than being mistaken for an unreachable deployer. Unreadable
   * rows are skipped and reported — they cannot be pushed anywhere until the
   * user re-enters them.
   */
  const { values, failedKeys } = decryptEnvVariables(stored)

  const warnings: string[] = []

  if (failedKeys.length > 0) {
    warnings.push(
      `${failedKeys.join(", ")} could not be decrypted — replace the value to re-encrypt it.`
    )
  }

  try {
    const response = await syncEnvironmentVariablesWrapper({
      projectId,
      deploymentIds: deployments.map((deployment) => deployment.id),
      environmentVariables: values,
    })

    const syncedDeployments = response.updatedDeploymentIds.length

    if (syncedDeployments < deployments.length) {
      warnings.push(
        "Some deployments had no running workload to update — they will pick the variables up on their next deploy."
      )
    }

    return {
      action: "SECRET_SYNC",
      deploymentId: null,
      buildId: null,
      syncedDeployments,
      warnings,
    }
  } catch (error) {
    console.error(
      "Failed to sync environment variables with the deployer:",
      error
    )

    return {
      action: "SECRET_SYNC",
      deploymentId: null,
      buildId: null,
      syncedDeployments: 0,
      warnings: [
        ...warnings,
        "The running workloads could not be updated — the deployer is unreachable.",
      ],
    }
  }
}
