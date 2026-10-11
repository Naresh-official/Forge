"use client"

import { getProject } from "@/lib/forge-data"
import { Card, CardContent } from "@forge/ui/components/card"
import { Progress } from "@forge/ui/components/progress"
import { PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

const resources = [
  ["CPU", "42%"],
  ["Memory", "1.8 GB"],
  ["Network", "842 GB"],
  ["Requests", "2.4M"],
] as const

export function ProjectResources({ projectId }: { projectId: string }) {
  const project = getProject(projectId)
  if (!project) return <div>Project not found.</div>
  return (
    <>
      <ProjectHeader project={project} />
      <PageHeader
        title="Resources"
        description="Current allocation and usage."
      />
      <div className="grid grid-cols-4 gap-2.5 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {resources.map(([label, value]) => (
          <Card key={label} size="sm">
            <CardContent>
              <span className="text-[9px] text-muted-foreground">{label}</span>
              <strong className="mt-2 block font-mono text-lg">{value}</strong>
              <small className="mt-1 block text-[9px] text-muted-foreground">
                this month
              </small>
              <Progress value={66} className="mt-2 block" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
