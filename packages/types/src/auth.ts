import z from "zod"

export const createUserSchema = z.object({
    name: z.string().min(1).max(255),
    email: z.email(),
    image: z.url().optional(),
    provider: z.string().min(1),
    providerAccountId: z.string().min(1),
    accessToken: z.string(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const findUserByEmailSchema = z.object({
    email: z.email(),
})

export type FindUserByEmailInput = z.infer<typeof findUserByEmailSchema>

export const createAccountSchema = z.object({
    userId: z.uuid(),
    provider: z.string().min(1),
    providerAccountId: z.string().min(1),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    accessTokenExpiresAt: z.coerce.date().optional(),
})

export type CreateAccountInput = z.infer<typeof createAccountSchema>

export type AuthUser = {
    id: string
    email: string
}
