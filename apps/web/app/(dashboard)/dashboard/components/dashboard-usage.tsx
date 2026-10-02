"use client"

import { useState } from "react"
import {
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  Server,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react"
import Link from "next/link"

type UsageCategory = "all" | "static" | "server" | "builds" | "traffic"

interface UsageMetric {
  id: string
  name: string
  category: "static" | "server" | "builds" | "traffic"
  typeBadge: "Static" | "Server" | "Pipeline" | "Edge"
  icon: React.ElementType
  used: number
  limit: number
  unit: string
  formattedUsed: string
  formattedLimit: string
  percent: number
  trend: string
  sparkline: number[]
  topProject: {
    name: string
    share: string
  }
  extraDetail?: string
}

const USAGE_METRICS: UsageMetric[] = [
  {
    id: "fast-data-transfer",
    name: "Fast Data Transfer (Bandwidth)",
    category: "static",
    typeBadge: "Static",
    icon: Globe,
    used: 284.5,
    limit: 1000,
    unit: "GB",
    formattedUsed: "284.5 GB",
    formattedLimit: "1.0 TB",
    percent: 28.5,
    trend: "+12.4% vs last week",
    sparkline: [22, 28, 35, 30, 42, 48, 55],
    topProject: { name: "northstar-web", share: "58%" },
    extraDetail: "Outbound CDN bandwidth for static HTML/JS/assets",
  },
  {
    id: "server-compute",
    name: "Server Container vCPU & RAM",
    category: "server",
    typeBadge: "Server",
    icon: Server,
    used: 142.8,
    limit: 1000,
    unit: "GB-Hrs",
    formattedUsed: "142.8 GB-Hrs",
    formattedLimit: "1,000 GB-Hrs",
    percent: 14.3,
    trend: "+6.1% vs last week",
    sparkline: [12, 18, 15, 22, 26, 24, 29],
    topProject: { name: "signal-api", share: "72%" },
    extraDetail: "3 active container replicas • 58ms avg SSR duration",
  },
  {
    id: "edge-http-requests",
    name: "Static & Edge HTTP Requests",
    category: "static",
    typeBadge: "Static",
    icon: Zap,
    used: 3.42,
    limit: 15.0,
    unit: "M",
    formattedUsed: "3.42M",
    formattedLimit: "15.0M reqs",
    percent: 22.8,
    trend: "+15.2% vs last week",
    sparkline: [38, 42, 49, 45, 58, 62, 70],
    topProject: { name: "atlas-console", share: "54%" },
    extraDetail: "94.2% edge cache hit ratio across all static sites",
  },
  {
    id: "build-pipeline-minutes",
    name: "Build Pipeline Compute",
    category: "builds",
    typeBadge: "Pipeline",
    icon: Clock,
    used: 412,
    limit: 6000,
    unit: "mins",
    formattedUsed: "412 mins",
    formattedLimit: "6,000 mins",
    percent: 6.9,
    trend: "-3.2% vs last week",
    sparkline: [45, 60, 35, 50, 75, 40, 52],
    topProject: { name: "atlas-console", share: "60%" },
    extraDetail: "128 website builds • 1/4 concurrent workers active",
  },
  {
    id: "docker-registry-storage",
    name: "Docker Container Registry",
    category: "server",
    typeBadge: "Server",
    icon: Boxes,
    used: 14.6,
    limit: 50.0,
    unit: "GB",
    formattedUsed: "14.6 GB",
    formattedLimit: "50.0 GB",
    percent: 29.2,
    trend: "+4.5% vs last week",
    sparkline: [10, 11, 12, 13, 13.5, 14, 14.6],
    topProject: { name: "signal-api", share: "64%" },
    extraDetail: "18 container image tags stored for server apps",
  },
  {
    id: "static-artifact-storage",
    name: "Static Artifacts & S3 Cache",
    category: "static",
    typeBadge: "Static",
    icon: HardDrive,
    used: 8.4,
    limit: 50.0,
    unit: "GB",
    formattedUsed: "8.4 GB",
    formattedLimit: "50.0 GB",
    percent: 16.8,
    trend: "+1.8% vs last week",
    sparkline: [6.8, 7.0, 7.2, 7.5, 7.8, 8.1, 8.4],
    topProject: { name: "forge-docs", share: "48%" },
    extraDetail: "MinIO / S3 static bundles, HTML & assets",
  },
]

const PROJECT_DISTRIBUTION = [
  { name: "atlas-console", type: "Next.js SSR", share: 44, color: "bg-primary" },
  { name: "signal-api", type: "Node Server", share: 32, color: "bg-emerald-500" },
  { name: "northstar-web", type: "Astro Static", share: 16, color: "bg-sky-500" },
  { name: "forge-docs", type: "Static Docs", share: 8, color: "bg-amber-500" },
]

export function DashboardUsage() {
  const [activeCategory, setActiveCategory] = useState<UsageCategory>("all")

  const filteredMetrics =
    activeCategory === "all"
      ? USAGE_METRICS
      : USAGE_METRICS.filter((m) => m.category === activeCategory)

  // Overall average usage percentage for key indicators
  const averageUsagePercent = Math.round(
    USAGE_METRICS.reduce((acc, curr) => acc + curr.percent, 0) /
      USAGE_METRICS.length
  )

  return (
    <section className="mb-4 rounded-lg border border-border bg-card p-4.5">
      {/* Header with Title, Deployment Type Badges & Plan Status */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground">
              Deployment Usage & Resources
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
            <span className="rounded border border-border bg-secondary/50 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              Static + Server Workloads
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Current billing period:{" "}
            <span className="text-foreground">Oct 1 – Oct 31, 2026</span> ·{" "}
            <span className="font-mono">21 days</span> remaining
          </p>
        </div>

        <div className="flex items-center gap-2 max-sm:w-full max-sm:justify-between">
          <div className="text-right max-sm:text-left">
            <div className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Cycle Estimated Spend
            </div>
            <div className="font-mono text-sm font-semibold text-foreground">
              $0.00{" "}
              <span className="text-xs font-normal text-muted-foreground">
                / $20.00 incl.
              </span>
            </div>
          </div>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Manage plan
            <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      {/* Overview Progress & Project Breakdown Bar */}
      <div className="my-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col justify-between rounded-md border border-border/80 bg-background/50 p-3.5 lg:col-span-5">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                Deployment Quota Utilized
              </span>
              <span className="font-mono font-semibold text-foreground">
                {averageUsagePercent}% avg
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${averageUsagePercent}%` }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-emerald-400" />0 overage
              fees projected
            </span>
            <span>Resets Nov 1, 00:00 UTC</span>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-md border border-border/80 bg-background/50 p-3.5 lg:col-span-7">
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">
                Resource Consumption by Website
              </span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">
                4 Active Deployments
              </span>
            </div>
            <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {PROJECT_DISTRIBUTION.map((proj) => (
                <div
                  key={proj.name}
                  className={`h-full ${proj.color} transition-all duration-300`}
                  style={{ width: `${proj.share}%` }}
                  title={`${proj.name} (${proj.type}): ${proj.share}%`}
                />
              ))}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px]">
            {PROJECT_DISTRIBUTION.map((proj) => (
              <div key={proj.name} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${proj.color}`} />
                <span className="font-mono text-foreground">{proj.name}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({proj.type})
                </span>
                <span className="font-mono text-muted-foreground">
                  {proj.share}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mb-3 flex items-center justify-between gap-2 overflow-x-auto border-b border-border/60 pb-2.5 text-xs">
        <div className="flex items-center gap-1">
          {(
            [
              { id: "all", label: "All metrics" },
              { id: "static", label: "Static Sites & CDN" },
              { id: "server", label: "Server Containers & SSR" },
              { id: "builds", label: "Builds & Pipelines" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={[
                "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                activeCategory === tab.id
                  ? "bg-secondary font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-muted-foreground max-md:hidden">
          Showing {filteredMetrics.length} of {USAGE_METRICS.length} deployment
          metrics
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filteredMetrics.map((metric) => {
          const Icon = metric.icon
          const isWarning = metric.percent >= 80
          const isCaution = metric.percent >= 50 && metric.percent < 80

          const maxSpark = Math.max(...metric.sparkline)
          const minSpark = Math.min(...metric.sparkline)

          return (
            <article
              key={metric.id}
              className="group relative flex flex-col justify-between rounded-lg border border-border/90 bg-card p-3.5 transition-all hover:border-border hover:bg-card/80"
            >
              <div>
                {/* Metric Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid size-7 place-items-center rounded-md border border-border bg-secondary text-foreground">
                      <Icon className="size-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-xs font-semibold text-foreground leading-tight">
                          {metric.name}
                        </h3>
                        <span
                          className={[
                            "rounded px-1 py-0.2 text-[9px] font-mono",
                            metric.typeBadge === "Static"
                              ? "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                              : metric.typeBadge === "Server"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : metric.typeBadge === "Pipeline"
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                  : "bg-purple-500/10 text-purple-400 border border-purple-500/20",
                          ].join(" ")}
                        >
                          {metric.typeBadge}
                        </span>
                      </div>
                      {metric.extraDetail && (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {metric.extraDetail}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={[
                      "rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap",
                      isWarning
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : isCaution
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground",
                    ].join(" ")}
                  >
                    {metric.percent}%
                  </span>
                </div>

                {/* Main Values & Limits */}
                <div className="mt-3 flex items-baseline justify-between">
                  <div className="font-mono text-xl font-bold tracking-tight text-foreground">
                    {metric.formattedUsed}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    limit: {metric.formattedLimit}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={[
                      "h-full rounded-full transition-all duration-500",
                      isWarning
                        ? "bg-amber-400"
                        : isCaution
                          ? "bg-primary"
                          : "bg-primary/90",
                    ].join(" ")}
                    style={{ width: `${Math.min(metric.percent, 100)}%` }}
                  />
                </div>
              </div>

              {/* Bottom Info: Trend, Sparkline & Top Contributor */}
              <div className="mt-3.5 border-t border-border/50 pt-2.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <span className="block text-[10px] text-muted-foreground">
                      Top deployment:{" "}
                      <span className="font-mono font-medium text-foreground">
                        {metric.topProject.name}
                      </span>{" "}
                      <span className="font-mono text-muted-foreground">
                        ({metric.topProject.share})
                      </span>
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <TrendingUp className="size-3 text-muted-foreground" />
                      {metric.trend}
                    </span>
                  </div>

                  {/* 7-day mini sparkline visual */}
                  <div className="flex h-5.5 items-end gap-1 rounded bg-secondary/30 px-1 py-0.5">
                    {metric.sparkline.map((val, idx) => {
                      const heightPercent = Math.max(
                        15,
                        Math.round(
                          ((val - minSpark * 0.8) /
                            (maxSpark - minSpark * 0.8 || 1)) *
                            100
                        )
                      )
                      return (
                        <div
                          key={idx}
                          className="w-1 rounded-xs bg-primary/70 transition-all hover:bg-primary"
                          style={{ height: `${heightPercent}%` }}
                          title={`Day ${idx + 1}: ${val}`}
                        />
                      )
                    })}
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
