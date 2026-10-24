import { signIn } from "@/auth"
import { ForgeLogo } from "./components/forge-logo"
import { Button } from "@forge/ui/components/button"
import { FaGithub } from "react-icons/fa"

/**
 * Only same-origin paths are accepted as a post-login destination, so the
 * `callbackUrl` query parameter cannot turn into an open redirect.
 */
function safeRedirectPath(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard"
  }

  return value
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams
  const redirectTo = safeRedirectPath(callbackUrl)

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm text-center">
        <ForgeLogo />
        <p className="mb-2.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          Developer platform
        </p>
        <h1 className="text-3xl font-semibold tracking-tighter">
          Ship without friction.
        </h1>
        <p className="mt-2 text-xs leading-6 text-muted-foreground">
          Connect GitHub and deploy your next idea in seconds.
        </p>
        <form
          action={async () => {
            "use server"
            await signIn("github", {
              redirectTo,
            })
          }}
        >
          <Button type="submit" size={"lg"} className="mt-7 w-full gap-2">
            <FaGithub className="size-4" /> Continue with GitHub
          </Button>
        </form>

        <small className="mt-3 block text-xs text-muted-foreground">
          GitHub is the only authentication provider supported by Forge.
        </small>
      </div>
    </div>
  )
}
