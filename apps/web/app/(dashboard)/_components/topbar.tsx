"use client"

import { Bell, CircleDot, Menu, Search } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { notifications, getProject } from "@/lib/forge-data"

export function Topbar({
    onMenu,
    onSearch,
}: {
    onMenu: () => void
    onSearch: () => void
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [notificationsOpen, setNotificationsOpen] = useState(false)
    const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1]
    const project = projectId ? getProject(projectId) : null

    return (
        <header className="flex h-16 items-center justify-between border-b border-border px-[clamp(17px,4vw,50px)]">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <button type="button" onClick={onMenu} className="md:hidden">
                    <Menu className="size-4" />
                </button>
                <span>Acme Cloud</span>
                <span>/</span>
                <strong className="font-medium text-foreground">
                    {project?.name ??
                        (pathname === "/dashboard"
                            ? "Overview"
                            : (pathname.split("/").filter(Boolean).at(-1) ??
                              "Overview"))}
                </strong>
            </div>

            <div className="flex items-center gap-2.5">
                <button
                    type="button"
                    onClick={onSearch}
                    className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-[11px] text-muted-foreground"
                >
                    <Search className="size-3.5" />
                    <span className="max-sm:hidden">Search</span>
                    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[9px] max-sm:hidden">
                        ⌘ K
                    </kbd>
                </button>
                <button
                    type="button"
                    aria-label="Theme"
                    className="grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground"
                >
                    <CircleDot className="size-4" />
                </button>
                <div className="relative">
                    <button
                        type="button"
                        aria-label="Notifications"
                        onClick={() => setNotificationsOpen((v) => !v)}
                        className="relative grid size-8 place-items-center rounded-md border border-border bg-card text-muted-foreground"
                    >
                        <Bell className="size-4" />
                        <span className="absolute top-1.5 right-1.5 size-1 rounded-full bg-rose-400" />
                    </button>
                    {notificationsOpen && (
                        <div className="absolute top-10 right-0 z-50 w-64 rounded-lg border border-border bg-popover p-3 shadow-2xl">
                            <strong className="text-xs">Notifications</strong>
                            {notifications.map((item) => (
                                <p
                                    key={item}
                                    className="mt-2.5 flex gap-2 border-t border-border pt-2.5 text-sm text-muted-foreground"
                                >
                                    <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
                                    {item}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={() => router.push("/settings/profile")}
                    className="grid size-8 place-items-center rounded-md border border-primary/40 bg-primary/10 text-sm font-bold text-primary"
                >
                    JD
                </button>
            </div>
        </header>
    )
}
