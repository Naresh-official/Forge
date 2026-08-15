import z from "zod"

export const createRepositorySchema = z.object({
    repositoryId: z.int(),
    projectName: z.string().optional(),
})

export type CreateRepositoryInput = z.infer<typeof createRepositorySchema>
