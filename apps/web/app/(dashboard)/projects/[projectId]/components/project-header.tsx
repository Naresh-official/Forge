"use client"

import { ArrowLeft, Rocket } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import type { Project } from "@/lib/forge-data"
import { projectTabs } from "@/lib/forge-data"
import { StatusBadge } from "../../../_components/ui"

export function ProjectHeader({ project }: { project: Project }) {
    const router = useRouter()
    const pathname = usePathname()

    return (
        <div className="relative mb-7 border-b border-border pb-4">
            <button
                type="button"
                onClick={() => router.push("/projects")}
                className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
            >
                <ArrowLeft className="size-3.5" /> Projects
            </button>
            <div className="flex items-center gap-2.5">
                <span className="size-2 rounded-full bg-primary" />
                <h1 className="text-2xl font-semibold tracking-[-.04em]">
                    {project.name}
                </h1>
                <StatusBadge status={project.status} />
            </div>
            <p className="mt-2 mb-4 ml-4 text-[11px] text-muted-foreground">
                {project.repo} ·{" "}
                <a href={`https://${project.url}`} className="text-primary">
                    {project.url}
                </a>
            </p>
            <div className="mb-3 flex gap-2">
                <button
                    type="button"
                    onClick={() =>
                        router.push(`/projects/${project.id}/deployments`)
                    }
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
                >
                    Deploy <Rocket className="size-3.5" />
                </button>
                <button
                    type="button"
                    onClick={() =>
                        router.push(`/projects/${project.id}/settings`)
                    }
                    className="rounded-md border border-border bg-card px-3 py-2 text-[11px]"
                >
                    Settings
                </button>
            </div>
            <nav className="flex gap-5 overflow-x-auto">
                {projectTabs.map((tab) => {
                    const href = `/projects/${project.id}/${tab === "Overview" ? "" : tab.toLowerCase().replaceAll(" ", "-")}`
                    const active =
                        pathname === href ||
                        (tab === "Overview" &&
                            pathname === `/projects/${project.id}`)
                    return (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => router.push(href)}
                            className={[
                                "border-b-2 py-2 text-sm whitespace-nowrap",
                                active
                                    ? "border-primary text-foreground"
                                    : "border-transparent text-muted-foreground",
                            ].join(" ")}
                        >
                            {tab}
                        </button>
                    )
                })}
            </nav>
        </div>
    )
}
