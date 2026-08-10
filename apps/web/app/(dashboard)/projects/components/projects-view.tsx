"use client"

import { ChevronDown, GitBranch, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { projects } from "@/lib/forge-data"
import { PageHeader, StatusBadge } from "../../_components/ui"

export function ProjectsView() {
    const router = useRouter()
    const [query, setQuery] = useState("")

    const filtered = projects.filter((p) =>
        `${p.name} ${p.repo}`.toLowerCase().includes(query.toLowerCase())
    )

    return (
        <>
            <PageHeader
                title="Projects"
                description="Manage your applications and deployments."
                action="New project"
                onAction={() => router.push("/projects/new")}
            />

            <div className="mb-5 flex flex-wrap gap-2">
                <label className="flex h-9 min-w-60 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-muted-foreground max-sm:w-full">
                    <Search className="size-3.5" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search projects"
                        className="min-w-0 flex-1 bg-transparent text-[11px] outline-none"
                    />
                </label>
                {["Status", "Framework", "Sort"].map((item) => (
                    <button
                        key={item}
                        type="button"
                        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
                    >
                        {item} <ChevronDown className="size-3.5" />
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
                {filtered.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="rounded-lg border border-border bg-card p-[17px] text-left transition hover:-translate-y-px hover:border-primary/50"
                    >
                        <div className="flex items-center justify-between">
                            <span className="size-2 rounded-full bg-primary" />
                            <StatusBadge status={p.status} />
                        </div>
                        <h3 className="mt-4 text-sm font-semibold">{p.name}</h3>
                        <p className="mt-1 mb-5 text-sm text-muted-foreground">
                            {p.repo}
                        </p>
                        <div className="flex items-center justify-between border-t border-border pt-3 font-mono text-sm text-muted-foreground">
                            <span>
                                <GitBranch className="mr-1 inline size-3.5" />
                                {p.branch}
                            </span>
                            <span>{p.framework}</span>
                        </div>
                        <div className="mt-4 flex justify-between text-[9px] text-muted-foreground">
                            <span className="text-muted-foreground">
                                {p.url}
                            </span>
                            <span>{p.updated}</span>
                        </div>
                    </button>
                ))}
            </div>
        </>
    )
}
