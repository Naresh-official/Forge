import { Activity } from "lucide-react"

const METRICS = [
  ["Active projects", "03"],
  ["Deployments", "128"],
  ["Success rate", "99.8%"],
  ["Avg. response", "184ms"],
] as const

/** Static workspace metrics — no state, so it renders on the server. */
export function DashboardMetrics() {
  return (
    <section className="mb-4 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-2">
      {METRICS.map(([label, value]) => (
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
  )
}
