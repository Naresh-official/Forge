"use client"

import { GitBranch, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"

export function LoginView() {
    const router = useRouter()
    return (
        <div className="grid min-h-screen place-items-center bg-background px-4 text-foreground">
            <div className="w-full max-w-sm text-center">
                <div className="mb-12 flex items-center justify-center gap-2 text-lg font-bold tracking-[-.04em]">
                    <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
                        <Sparkles className="size-3.5" />
                    </span>
                    forge
                </div>
                <p className="mb-2.5 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                    Developer platform
                </p>
                <h1 className="text-3xl font-semibold tracking-[-.05em]">
                    Ship without friction.
                </h1>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    Connect GitHub and deploy your next idea in seconds.
                </p>
                <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="mt-7 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-[11px]"
                >
                    <GitBranch className="size-4" /> Continue with GitHub
                </button>
                <small className="mt-3 block text-[9px] text-muted-foreground">
                    GitHub is the only authentication provider supported by
                    Forge.
                </small>
            </div>
        </div>
    )
}
