"use client"

import { Copy } from "lucide-react"
import { getProject, logs } from "@/lib/forge-data"
import { PageHeader } from "../../../_components/ui"
import { ProjectHeader } from "./project-header"

export function ProjectLogs({ projectId }: { projectId: string }) {
  const project = getProject(projectId)
  if (!project) return <div>Project not found.</div>
  return (
    <>
      <ProjectHeader project={project} />
      <PageHeader
        title="Logs"
        description="Build and runtime logs for this project."
      />
      <LogViewer />
    </>
  )
}

export function LogViewer() {
  return (
    <article className="rounded-lg border border-border bg-card p-[18px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xs font-semibold">Build logs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live deployment output
          </p>
        </div>
        <button
          type="button"
          className="grid size-7 place-items-center rounded-md border border-border"
        >
          <Copy className="size-3.5" />
        </button>
      </div>
      <div className="mt-4 max-h-80 overflow-auto rounded-md border border-border bg-background p-3">
        {logs.map((line, i) => (
          <div
            key={`${line}-${i}`}
            className="grid grid-cols-[32px_66px_1fr] gap-2.5 font-mono text-sm leading-[1.9] whitespace-nowrap"
          >
            <span className="text-muted-foreground">
              {String(i + 1).padStart(3, "0")}
            </span>
            <time className="text-muted-foreground">
              12:4{i}:0{i}
            </time>
            <code
              className={
                line.includes("ready")
                  ? "text-emerald-400"
                  : "text-muted-foreground"
              }
            >
              {line}
            </code>
          </div>
        ))}
      </div>
    </article>
  )
}
