import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { webConfig } from "@workspace/config/web"
import { handleGithubAuth } from "@workspace/api-client/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub({
            clientId: webConfig.authGithubId,
            clientSecret: webConfig.authGithubSecret,
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === "github") {
                    const response = await handleGithubAuth({
                        email: user.email as string,
                        name: user.name as string,
                        image: user.image as string,
                        provider: account.provider as string,
                        providerAccountId: account.providerAccountId as string,
                        accessToken: account.access_token as string,
                    })

                    if (response.data?.id) return true
                }
                return false
            } catch (error) {
                console.log(error instanceof Error ? error.message : error)
                return false
            }
        },
    },
})
