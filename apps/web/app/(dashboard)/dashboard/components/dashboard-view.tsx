"use client"

import {
  Activity,
  ArrowUpRight,
  ExternalLink,
  Globe2,
  GitBranch,
  Server,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { projects } from "@/lib/forge-data"
import { DataTable, PageHeader, StatusBadge } from "../../_components/ui"
import { useToast } from "../../_components/toast-provider"
import { DashboardUsage } from "./dashboard-usage"

const metrics = [
  ["Active projects", "03"],
  ["Deployments", "128"],
  ["Success rate", "99.8%"],
  ["Avg. response", "184ms"],
] as const

export function DashboardView() {
  const router = useRouter()
  const { notify } = useToast()

  return (
    <>
      <PageHeader
        eyebrow={new Date().toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
        title="Good morning, Jordan"
        description="Here's what's happening across your workspace."
        action="New project"
        onAction={() => router.push("/projects/new")}
      />

      <section className="mb-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-2">
        {metrics.map(([label, value]) => (
          <article
            key={label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{label}</span>
              <Activity className="size-4" />
            </div>
            <div className="mt-3 font-mono text-3xl tracking-[-0.08em]">
              {value}
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              <span className="mr-1 text-emerald-400">+18.4%</span> from last
              month
            </div>
          </article>
        ))}
      </section>

      <DashboardUsage />

      <article className="rounded-lg border border-border bg-card p-4.5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xs font-semibold">Recent projects</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your most recently updated environments
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/projects")}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            View projects
          </button>
        </div>
        <DataTable>
          <thead>
            <tr className="text-[9px] tracking-widest text-muted-foreground uppercase">
              {["Project", "Framework", "Branch", "Status", "Updated"].map(
                (h) => (
                  <th key={h} className="px-3 pb-2 text-left font-semibold">
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/projects/${p.id}`)}
                className="cursor-pointer border-t border-border hover:bg-primary/[.035]"
              >
                <td className="px-3 py-3 text-[11px] font-medium">
                  <span className="mr-2 inline-block size-1.5 rounded-full bg-primary" />
                  {p.name}
                </td>
                <td className="px-3 py-3 text-[11px]">
                  <span className="rounded border border-border px-1.5 py-1 text-[9px] text-muted-foreground">
                    {p.framework}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-sm text-muted-foreground">
                  <GitBranch className="mr-1 inline size-3.5" />
                  {p.branch}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge status={p.status} />
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">
                  {p.updated}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </article>
    </>
  )
}
