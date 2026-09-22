import type { OAuthProvider } from "@/generated/prisma/enums"
import prisma from "../../utils/db"
import type { CreateUserInput, FindUserByEmailInput } from "@forge/types/auth"

export const createUserAndAccountService = async (input: CreateUserInput) => {
  const existingUser = await findUserByEmailService({ email: input.email })
  const provider = input.provider.trim().toUpperCase() as OAuthProvider

  if (existingUser) {
    await prisma.account.upsert({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: input.providerAccountId,
        },
      },
      update: {
        accessToken: input.accessToken,
      },
      create: {
        userId: existingUser.id,
        provider,
        providerAccountId: input.providerAccountId,
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
          provider,
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
