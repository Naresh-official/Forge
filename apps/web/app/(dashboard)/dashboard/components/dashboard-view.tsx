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
                eyebrow="Friday, August 8, 2026"
                title="Good morning, Jordan"
                description="Here's what's happening across your workspace."
                action="New project"
                onAction={() => router.push("/projects/new")}
            />

            <section className="mb-3 grid grid-cols-4 gap-3 max-lg:grid-cols-2 max-sm:grid-cols-2">
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
                            <span className="mr-1 text-emerald-400">
                                +18.4%
                            </span>{" "}
                            from last month
                        </div>
                    </article>
                ))}
            </section>

            <section className="mb-3 grid grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)] gap-3 max-lg:grid-cols-1">
                <article className="rounded-lg border border-border bg-card p-[18px]">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-xs font-semibold">
                                Deployment activity
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Successful builds over the last 30 days
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push("/deployments")}
                            className="inline-flex items-center gap-1 text-sm text-primary"
                        >
                            View all <ArrowUpRight className="size-3.5" />
                        </button>
                    </div>

                    <div className="mt-6 flex h-48 items-end gap-3 border-b border-border bg-[repeating-linear-gradient(to_bottom,transparent_0,transparent_47px,hsl(var(--border)/.35)_48px)]">
                        <div className="flex h-full flex-col justify-between pb-1 font-mono text-[9px] text-muted-foreground">
                            {[40, 30, 20, 10, 0].map((n) => (
                                <span key={n}>{n}</span>
                            ))}
                        </div>
                        <div className="flex h-full flex-1 items-end gap-[clamp(2px,.7vw,8px)] px-1">
                            {[
                                24, 31, 28, 34, 27, 35, 32, 38, 30, 34, 26, 39,
                                34, 36, 31, 37, 35, 40, 34, 38, 32, 35, 39, 31,
                                36, 40, 35, 38, 34, 39,
                            ].map((height, i) => (
                                <div
                                    key={i}
                                    className="max-w-[17px] flex-1 rounded-t-sm bg-primary/80"
                                    style={{
                                        height: `${height * 2}px`,
                                        opacity: i % 3 === 2 ? 0.55 : 0.85,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </article>

                <article className="rounded-lg border border-border bg-card p-[18px]">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xs font-semibold">
                                System status
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                All systems operational
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-sm text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-400" />{" "}
                            Live
                        </span>
                    </div>
                    <div className="mt-5">
                        {[
                            [Globe2, "Edge network", "Global availability"],
                            [Server, "Build pipeline", "CI/CD workers"],
                        ].map(([Icon, title, meta]) => {
                            const Component = Icon as typeof Globe2
                            return (
                                <div
                                    key={title as string}
                                    className="flex items-center gap-2.5 border-t border-border py-3"
                                >
                                    <span className="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
                                        <Component className="size-3.5" />
                                    </span>
                                    <span className="flex flex-1 flex-col gap-1">
                                        <strong className="text-[11px] font-medium">
                                            {title as string}
                                        </strong>
                                        <small className="text-[9px] text-muted-foreground">
                                            {meta as string}
                                        </small>
                                    </span>
                                    <StatusBadge status="Operational" />
                                </div>
                            )
                        })}
                    </div>
                    <button
                        type="button"
                        onClick={() => notify("Status page opened")}
                        className="mt-1 flex w-full justify-center border-t border-border pt-3 text-sm text-primary"
                    >
                        View status page{" "}
                        <ExternalLink className="ml-1 size-3" />
                    </button>
                </article>
            </section>

            <article className="rounded-lg border border-border bg-card p-[18px]">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xs font-semibold">
                            Recent projects
                        </h2>
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
                            {[
                                "Project",
                                "Framework",
                                "Branch",
                                "Status",
                                "Updated",
                            ].map((h) => (
                                <th
                                    key={h}
                                    className="px-3 pb-2 text-left font-semibold"
                                >
                                    {h}
                                </th>
                            ))}
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
