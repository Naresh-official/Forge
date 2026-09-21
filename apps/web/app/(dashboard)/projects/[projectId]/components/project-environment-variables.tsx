"use client"

import { useState } from "react"
import { getProject, envVars } from "@/lib/forge-data"
import { CopyButton, DataTable, PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

export function ProjectEnvironmentVariables({
  projectId,
}: {
  projectId: string
}) {
  const project = getProject(projectId)
  const [visible, setVisible] = useState<string[]>([])
  if (!project) return <div>Project not found.</div>
  return (
    <>
      <ProjectHeader project={project} />
      <PageHeader
        title="Environment variables"
        description="Secrets and configuration scoped to each environment."
        action="Add variable"
      />
      <div className="mb-4 flex gap-1 border-b border-border">
        <button
          type="button"
          className="border-b-2 border-primary px-3 py-2 text-sm"
        >
          Production
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          Preview
        </button>
        <button
          type="button"
          className="px-3 py-2 text-sm text-muted-foreground"
        >
          Development
        </button>
      </div>
      <DataTable>
        <thead>
          <tr className="text-[9px] tracking-widest text-muted-foreground uppercase">
            {["Variable", "Value", "Environment", "Updated", "Actions"].map(
              (h) => (
                <th key={h} className="px-3 pb-2 text-left">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {envVars.map((v) => (
            <tr key={v.name} className="border-t border-border">
              <td className="px-3 py-3">
                <code className="text-sm text-primary">{v.name}</code>
              </td>
              <td className="px-3 py-3 font-mono text-sm text-muted-foreground">
                {visible.includes(v.name) ? v.value : "••••••••••••••"}{" "}
                <button
                  type="button"
                  className="ml-2 text-primary"
                  onClick={() =>
                    setVisible((cur) =>
                      cur.includes(v.name)
                        ? cur.filter((n) => n !== v.name)
                        : [...cur, v.name]
                    )
                  }
                >
                  {visible.includes(v.name) ? "Hide" : "Reveal"}
                </button>
              </td>
              <td className="px-3 py-3 text-[11px]">{v.environment}</td>
              <td className="px-3 py-3 text-sm text-muted-foreground">
                {v.updated}
              </td>
              <td className="px-3 py-3">
                <CopyButton value={v.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </>
  )
}
