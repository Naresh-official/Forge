"use client"

import { getProject } from "@/lib/forge-data"
import { DomainsView } from "../../../domains/components/domains-view"
import { ProjectHeader } from "./project-header"

export function ProjectDomains({ projectId }: { projectId: string }) {
    const project = getProject(projectId)
    if (!project) return <div>Project not found.</div>
    return (
        <>
            <ProjectHeader project={project} />
            <DomainsView projectId={projectId} />
        </>
    )
}
