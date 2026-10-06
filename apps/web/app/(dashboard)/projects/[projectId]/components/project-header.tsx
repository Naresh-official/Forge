"use client"

import { ArrowLeft, Rocket } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { projectTabs } from "@/lib/forge-data"
import { StatusBadge } from "../../../_components/ui"

/**
 * The subset of project fields the header renders. Structural, so both the
 * mock project shape and the real API project shape satisfy it.
 */
export type ProjectHeaderData = {
  id: string
  name: string
  status?: string | null
  repo?: string | null
  url?: string | null
}

export function ProjectHeader({ project }: { project: ProjectHeaderData }) {
  const router = useRouter()
  const pathname = usePathname()

  /*
   * Navigate relative to the id in the URL, not the passed-in project. Some
   * pages still read from mock data and fall back to the first mock project
   * when the real id is unknown, which would otherwise send every tab (e.g.
   * Logs) to the wrong project.
   */
  const pathProjectId =
    pathname.match(/^\/projects\/([^/]+)/)?.[1] ?? project.id

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
        <StatusBadge status={project.status ?? undefined} />
      </div>
      <p className="mt-2 mb-4 ml-4 text-[11px] text-muted-foreground">
        {project.repo ?? "—"} ·{" "}
        {project.url ? (
          <a href={`https://${project.url}`} className="text-primary">
            {project.url}
          </a>
        ) : (
          "—"
        )}
      </p>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => router.push(`/projects/${pathProjectId}/deployments`)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-[11px] font-bold text-primary-foreground"
        >
          Deploy <Rocket className="size-3.5" />
        </button>
      </div>
      <nav className="flex gap-5 overflow-x-auto">
        {projectTabs.map((tab) => {
          const href = `/projects/${pathProjectId}/${tab === "Overview" ? "" : tab.toLowerCase().replaceAll(" ", "-")}`
          const active =
            pathname === href ||
            (tab === "Overview" && pathname === `/projects/${pathProjectId}`)
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
