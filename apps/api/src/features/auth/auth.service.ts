import type { RepositoryProvider } from "@/generated/prisma/enums"
import prisma from "../../utils/db"
import type { CreateUserInput, FindUserByEmailInput } from "@forge/types/auth"

export const createUserAndAccountService = async (input: CreateUserInput) => {
    const existingUser = await findUserByEmailService({ email: input.email })

    if (existingUser) {
        await prisma.account.update({
            where: {
                userId_provider: {
                    userId: existingUser.id,
                    provider: input.provider
                        .trim()
                        .toUpperCase() as RepositoryProvider,
                },
            },
            data: {
                accessToken: input.accessToken,
            },
        })
        return existingUser
    }

    const newUser = await prisma.user.create({
        data: {
            name: input.name,
            email: input.email,
            image: input.image,
            accounts: {
                create: {
                    provider: input.provider
                        .trim()
                        .toUpperCase() as RepositoryProvider,
                    providerAccountId: input.providerAccountId,
                    accessToken: input.accessToken,
                },
            },
        },
        include: {
            accounts: true,
        },
    })

    return newUser
}

export const findUserByEmailService = async (input: FindUserByEmailInput) => {
    return await prisma.user.findUnique({
        where: {
            email: input.email,
        },
    })
}
