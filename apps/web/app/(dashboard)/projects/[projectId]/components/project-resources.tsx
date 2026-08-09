"use client"

import { getProject } from "@/lib/forge-data"
import { PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

const resources = [["CPU","42%"],["Memory","1.8 GB"],["Network","842 GB"],["Requests","2.4M"]] as const

export function ProjectResources({ projectId }: { projectId: string }) {
  const project = getProject(projectId)
  if (!project) return <div>Project not found.</div>
  return <><ProjectHeader project={project} /><PageHeader title="Resources" description="Current allocation and usage." /><div className="grid grid-cols-4 gap-2.5 max-lg:grid-cols-2 max-sm:grid-cols-1">{resources.map(([label,value])=><article key={label} className="rounded-md border border-border bg-card p-3"><span className="text-[9px] text-muted-foreground">{label}</span><strong className="mt-2 block font-mono text-lg">{value}</strong><small className="mt-1 block text-[9px] text-muted-foreground">this month</small><div className="mt-2 h-0.5 bg-border"><span className="block h-full w-2/3 bg-primary" /></div></article>)}</div></>
}
