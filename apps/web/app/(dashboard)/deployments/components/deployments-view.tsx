"use client"

import { ChevronDown, GitBranch, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { deployments, type Deployment } from "@/lib/forge-data"
import { DataTable, PageHeader, StatusBadge } from "../../_components/ui"

export function DeploymentsView() {
  const router = useRouter()

  return (
    <>
      <PageHeader
        title="Deployments"
        description="Every build, preview, and production release across your projects."
      />
      <div className="mb-5 flex flex-wrap gap-2">
        <div className="flex h-9 min-w-60 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-muted-foreground max-sm:w-full">
          <Search className="size-3.5" />
          <input
            placeholder="Search deployments"
            className="flex-1 bg-transparent text-[11px] outline-none"
          />
        </div>
        {["Project", "Environment", "Status"].map((item) => (
          <button
            key={item}
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
          >
            {item}
            <ChevronDown className="size-3.5" />
          </button>
        ))}
      </div>
      <DeploymentTable
        onSelect={(d) =>
          router.push(`/projects/${d.project}/deployments/${d.id}`)
        }
      />
    </>
  )
}

export function DeploymentTable({
  onSelect,
}: {
  onSelect: (deployment: Deployment) => void
}) {
  return (
    <DataTable>
      <thead>
        <tr className="text-[9px] tracking-widest text-muted-foreground uppercase">
          {[
            "Status",
            "Deployment",
            "Project",
            "Branch",
            "Commit",
            "Environment",
            "Duration",
            "Created",
          ].map((h) => (
            <th key={h} className="px-3 pb-2 text-left font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {deployments.map((d) => (
          <tr
            key={d.id}
            onClick={() => onSelect(d)}
            className="cursor-pointer border-t border-border hover:bg-primary/[.035]"
          >
            <td className="px-3 py-3">
              <StatusBadge status={d.status} />
            </td>
            <td className="px-3 py-3">
              <strong className="text-[11px]">{d.id}</strong>
              <small className="mt-1 block text-[9px] text-muted-foreground">
                {d.message}
              </small>
            </td>
            <td className="px-3 py-3 text-[11px]">{d.project}</td>
            <td className="px-3 py-3 font-mono text-sm text-muted-foreground">
              <GitBranch className="mr-1 inline size-3.5" />
              {d.branch}
            </td>
            <td className="px-3 py-3 font-mono text-sm text-primary">
              {d.commit}
            </td>
            <td className="px-3 py-3 text-[11px]">{d.environment}</td>
            <td className="px-3 py-3 text-[11px]">{d.duration}</td>
            <td className="px-3 py-3 text-sm text-muted-foreground">
              {d.created}
            </td>
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}
