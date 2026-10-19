import z from "zod"
import {
  environmentVariableKeySchema,
  environmentVariableSchema,
} from "./deployment"

/**
 * Project environment variables as the dashboard sees them: keys and metadata
 * only. Values are encrypted at rest and are never returned by the API, so a
 * variable can be created, re-valued or deleted but not read back.
 */
export type ProjectEnvironmentVariableItem = {
  key: string
  isSecret: boolean
  /**
   * Whether the stored value still decrypts with the API's current key. A
   * variable written with an older/rotated `ENV_ENCRYPTION_SECRET` reports
   * `false` and must be re-entered before it reaches any workload.
   */
  readable: boolean
  createdAt: Date
  updatedAt: Date
}

export type ListProjectEnvironmentVariablesResponse =
  ProjectEnvironmentVariableItem[]

/** New variable — same validation as the preset variables in the wizard. */
export const createProjectEnvironmentVariableSchema = environmentVariableSchema

export type CreateProjectEnvironmentVariableInput = z.infer<
  typeof createProjectEnvironmentVariableSchema
>

/** Only the value changes on update; the key is part of the URL. */
export const updateProjectEnvironmentVariableSchema = z.object({
  value: z.string().max(65_536),
})

export type UpdateProjectEnvironmentVariableInput = z.infer<
  typeof updateProjectEnvironmentVariableSchema
>

/** Path parameter for the update/delete routes. */
export const projectEnvironmentVariableKeySchema = environmentVariableKeySchema

/**
 * What the API did to make a persisted change take effect.
 */
export type EnvironmentChangeAction = "REBUILD" | "SECRET_SYNC" | "NONE"

export type EnvironmentChange = {
  action: EnvironmentChangeAction
  /** Deployment (and build) started when a static project is rebuilt. */
  deploymentId: string | null
  buildId: string | null
  /** Number of running deployments whose Kubernetes Secret was updated. */
  syncedDeployments: number
  /** Non-fatal problems (e.g. the deployer was unreachable). */
  warnings: string[]
}

export type CreateProjectEnvironmentVariableResponse = {
  variable: ProjectEnvironmentVariableItem
  change: EnvironmentChange
}

export type UpdateProjectEnvironmentVariableResponse = {
  variable: ProjectEnvironmentVariableItem
  change: EnvironmentChange
}

export type DeleteProjectEnvironmentVariableResponse = {
  key: string
  change: EnvironmentChange
}
