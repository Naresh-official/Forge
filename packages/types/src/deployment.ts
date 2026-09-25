import z from "zod"

export const createRepositorySchema = z.object({
  repositoryId: z.int(),
  projectName: z.string().optional(),
})

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>

/**
 * Default resources assigned to every deployment.
 *
 * Mirrors CONTAINER_RESOURCES in apps/deployer Kubernetes constants:
 * - CPU:    500 m request / 1000 m limit
 * - Memory: 512 Mi request / 2048 Mi limit
 */
export const DEFAULT_DEPLOYMENT_RESOURCES = {
  cpuMillicores: 500,
  memoryMb: 512,
  ephemeralStorageMb: 1024,
  autoscalingEnabled: false,
} as const
