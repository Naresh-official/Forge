"use client"

import { ArrowLeft, Rocket } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { projectTabs } from "@/lib/forge-data"
import { Button } from "@forge/ui/components/button"
import { Tabs, TabsList, TabsTrigger } from "@forge/ui/components/tabs"
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

  const tabHref = (tab: string) =>
    `/projects/${pathProjectId}${tab === "Overview" ? "" : `/${tab.toLowerCase().replaceAll(" ", "-")}`}`

  const activeTab =
    projectTabs.find((tab) => pathname === tabHref(tab)) ?? "Overview"

  return (
    <div className="relative mb-7 border-b border-border pb-4">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push("/projects")}
        className="mb-4 gap-1.5 px-0 text-[11px] text-muted-foreground hover:bg-transparent hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Projects
      </Button>
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
        <Button
          type="button"
          size="lg"
          onClick={() => router.push(`/projects/${pathProjectId}/deployments`)}
          className="gap-2 text-[11px] font-bold"
        >
          Deploy <Rocket className="size-3.5" />
        </Button>
      </div>
      <Tabs
        value={activeTab}
        onValueChange={(value) => router.push(tabHref(value as string))}
      >
        <TabsList variant="line" className="gap-5">
          {projectTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  )
}
