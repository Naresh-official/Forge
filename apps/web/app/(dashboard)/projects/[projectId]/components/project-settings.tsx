"use client"

import { getProject } from "@/lib/forge-data"
import { PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

export function ProjectSettings({ projectId }: { projectId: string }) {
    const project = getProject(projectId)
    if (!project) return <div>Project not found.</div>
    return (
        <>
            <ProjectHeader project={project} />
            <PageHeader
                title="Project settings"
                description="Configure project-specific settings."
            />
            <article className="max-w-2xl rounded-lg border border-border bg-card p-[18px]">
                <div className="grid gap-4">
                    <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                        Project name
                        <input
                            defaultValue={project.name}
                            className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5 text-sm text-muted-foreground">
                        Repository
                        <input
                            defaultValue={project.repo}
                            className="rounded-md border border-border bg-background px-2.5 py-2 text-[11px] text-foreground outline-none"
                        />
                    </label>
                    <button
                        type="button"
                        className="w-fit rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
                    >
                        Save changes
                    </button>
                </div>
            </article>
        </>
    )
}
