import z from "zod"
import type { DeploymentStatus } from "./deployment"

export const projectFrameworkEnum = z.enum([
  "NEXTJS",
  "VITE",
  "REACT",
  "VUE",
  "NUXT",
  "SVELTE",
  "SVELTEKIT",
  "ASTRO",
  "ANGULAR",
  "REMIX",
  "NESTJS",
  "EXPRESS",
  "UNKNOWN",
])

export type ProjectFramework = z.infer<typeof projectFrameworkEnum>

export const projectStatusEnum = z.enum(["ACTIVE", "PAUSED"])

/** Lifecycle state of a project. PAUSED scales its workload to zero. */
export type ProjectStatus = z.infer<typeof projectStatusEnum>

export type ProjectDeployment = {
  branch: string
  status: "QUEUED" | "BUILDING" | "DEPLOYING" | "READY" | "FAILED" | "CANCELLED"
}

export type ProjectGithubRepository = {
  fullName: string
  defaultBranch: string
}

export type ProjectListItem = {
  id: string
  name: string
  slug: string
  status: ProjectStatus
  /** Detected from the linked repository; null when no repository is linked. */
  framework: ProjectFramework | null
  createdAt: Date
  updatedAt: Date
  deployments: ProjectDeployment
  githubRepository: ProjectGithubRepository | null
}

export type ListProjectsResponse = ProjectListItem[]

/** Lightweight project reference used where only a link target is needed. */
export type ProjectNameItem = {
  id: string
  name: string
}

export type ListProjectNamesResponse = ProjectNameItem[]

/**
 * One deployment within a project, used to pick which deployment's logs to
 * view. Mirrors the `Deployment` Prisma model.
 */
export type ProjectDeploymentItem = {
  id: string
  deploymentNumber: number
  status: DeploymentStatus
  branch: string
  commitSha: string
  commitMessage: string | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export type ListProjectDeploymentsResponse = ProjectDeploymentItem[]

/** New name for an existing project. */
export const renameProjectSchema = z.object({
  name: z.string().trim().min(1, "Project name is required").max(100),
})

export type RenameProjectInput = z.infer<typeof renameProjectSchema>

export const setProjectStatusSchema = z.object({
  status: projectStatusEnum,
})

export type SetProjectStatusInput = z.infer<typeof setProjectStatusSchema>

/** The project fields returned by the settings mutations. */
export type ProjectSettingsResponse = {
  id: string
  name: string
  slug: string
  status: ProjectStatus
}

/**
 * Result of deleting a project. `cleanupWarnings` is non-empty when some
 * external resource (Kubernetes, ECR, S3) could not be removed.
 */
export type DeleteProjectResponse = {
  id: string
  cleanupWarnings: string[]
}
