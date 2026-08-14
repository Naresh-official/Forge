import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { webConfig } from "@forge/config/web"
import { handleGithubAuth } from "@forge/api-client/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        GitHub({
            clientId: webConfig.authGithubId,
            clientSecret: webConfig.authGithubSecret,
        }),
    ],
    callbacks: {
        async signIn({ account }) {
            if (account?.provider === "github") {
                return true
            }
            return false
        },
        async jwt({ token, user, account }) {
            if (account && user) {
                try {
                    const response = await handleGithubAuth({
                        email: user.email as string,
                        name: user.name as string,
                        image: user.image as string,
                        provider: account.provider as string,
                        providerAccountId: account.providerAccountId as string,
                        accessToken: account.access_token as string,
                    })

                    if (response.data?.id) {
                        token.userId = response.data.id
                    }
                } catch (error) {
                    console.error("Failed to sync user with backend:", error)
                }
            }
            return token
        },
        async session({ session, token }) {
            if (session.user && token.userId) {
                session.user.id = token.userId as string
            }
            return session
        },
    },
})
