"use client"

import { Copy, Search, Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { CopyButton } from "../../../(dashboard)/_components/ui"

const groups = [
  [
    "Getting started",
    ["Introduction", "Quickstart", "Creating a project", "Deploying"],
  ],
  ["Projects", ["Configuration", "Environment variables", "Domains"]],
  [
    "Deployments",
    [
      "Deployments",
      "Preview deployments",
      "Production deployments",
      "Rollbacks",
    ],
  ],
] as const

export function DocsView() {
  const router = useRouter()
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-16 items-center justify-between gap-5 border-b border-border px-[6vw]">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="flex items-center gap-2 font-bold"
        >
          <span className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="size-3.5" />
          </span>
          forge <span className="text-[11px] text-muted-foreground">docs</span>
        </button>
        <div className="flex h-9 w-72 items-center gap-2 rounded-md border border-border bg-card px-2.5 max-md:hidden">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            placeholder="Search documentation"
            className="flex-1 bg-transparent text-[11px] outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="rounded-md border border-border bg-card px-3 py-2 text-sm"
        >
          Sign in
        </button>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-[190px_minmax(0,1fr)_140px] gap-14 px-6 py-14 max-lg:grid-cols-1">
        <aside className="flex flex-col gap-2 text-sm max-lg:hidden">
          {groups.map(([title, items]) => (
            <div key={title}>
              <strong className="mt-2 mb-2 block">{title}</strong>
              {items.map((item) => (
                <button
                  type="button"
                  key={item}
                  className="block py-1 text-left text-muted-foreground hover:text-primary"
                >
                  {item}
                </button>
              ))}
            </div>
          ))}
        </aside>
        <main>
          <p className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            Getting started
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.06em]">
            Build. Deploy. Ship.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Forge gives every project a fast, reliable path from GitHub commit
            to production.
          </p>
          <div className="my-8 overflow-hidden rounded-md border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[9px] text-muted-foreground">
              <span>Terminal</span>
              <CopyButton value="pnpm create forge-app" />
            </div>
            <code className="block p-4 font-mono text-xs leading-7 text-primary">
              $ pnpm create forge-app
              <br />$ cd my-project
              <br />$ forge deploy
            </code>
          </div>
          <h2 className="mb-5 text-xl font-semibold">How Forge works</h2>
          <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
            {[
              [
                "01",
                "Connect GitHub",
                "Choose a repository and import it into Forge.",
              ],
              [
                "02",
                "Configure your project",
                "Set your framework, build settings, and secrets.",
              ],
              [
                "03",
                "Deploy",
                "Every push creates a preview. Merge to ship production.",
              ],
            ].map(([n, t, d]) => (
              <article key={n} className="border-t border-border pt-3">
                <span className="font-mono text-sm text-primary">{n}</span>
                <h3 className="mt-3 text-xs font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
                  {d}
                </p>
              </article>
            ))}
          </div>
        </main>
        <aside className="flex flex-col gap-2 text-sm max-lg:hidden">
          <strong>On this page</strong>
          <a className="text-muted-foreground">Introduction</a>
          <a className="text-muted-foreground">How Forge works</a>
          <a className="text-muted-foreground">Next steps</a>
        </aside>
      </div>
    </div>
  )
}
