"use client"

import { MoreHorizontal } from "lucide-react"
import { deployments } from "@/lib/forge-data"
import { useToast } from "../../_components/toast-provider"
import { PageHeader, StatusBadge } from "../../_components/ui"

export function EnvironmentsView() {
  const { notify } = useToast()
  return (
    <>
      <PageHeader title="Environments" description="Production, preview, and development targets." action="Create environment" onAction={() => notify("Environment dialog opened")} />
      <div className="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-1">
        {["Production", "Preview", "Development"].map((name) => (
          <article key={name} className="rounded-lg border border-border bg-card p-[18px]">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xs font-semibold">{name}</h2><p className="mt-1 text-sm text-muted-foreground">{name === "Production" ? "atlas-console.forge.run" : `*.${name.toLowerCase()}.forge.run`}</p></div><StatusBadge status="Operational" /></div>
            <div className="mt-5 grid grid-cols-2 gap-4"><Info label="Latest deployment" value={deployments[0].id} /><Info label="Last deployed" value="12 min ago" /><Info label="Resources" value="2 vCPU · 4 GB" /></div>
            <div className="mt-5 flex gap-2"><button type="button" onClick={() => notify(`${name} settings opened`)} className="rounded-md border border-border bg-card px-3 py-2 text-sm">Manage</button><button type="button" aria-label="More options" className="grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground"><MoreHorizontal className="size-3.5" /></button></div>
          </article>
        ))}
      </div>
    </>
  )
}
function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1.5"><span className="text-[9px] text-muted-foreground">{label}</span><strong className="text-[11px] font-medium">{value}</strong></div>
}
