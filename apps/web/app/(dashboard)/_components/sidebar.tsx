"use client"

import {
  Box,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  Plus,
  Rocket,
  Server,
  Settings2,
  Sparkles,
  X,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { listProjectNames } from "@forge/api-client/project"
import { UserAvatar, displayNameFor, type SessionUser } from "./user-avatar"

const navigation = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: Box },
  { label: "Deployments", href: "/deployments", icon: Rocket },
  { label: "Domains", href: "/domains", icon: Globe2 },
  { label: "Environments", href: "/environments", icon: Server },
]

export function Sidebar({
  user,
  mobile,
  onClose,
}: {
  user: SessionUser
  mobile: boolean
  onClose: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const projectsQuery = useQuery({
    queryKey: ["project-names"],
    queryFn: listProjectNames,
  })
  const projectNames = projectsQuery.data?.data ?? []

  const go = (href: string) => {
    onClose()
    router.push(href)
  }

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-61 flex-col border-r border-border bg-background/90 p-3.5 backdrop-blur-xl transition-transform md:static md:translate-x-0",
        mobile ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}
    >
      <div className="flex h-8 items-center gap-2 px-2.5 text-[17px] font-bold tracking-[-0.04em]">
        <div className="grid size-6 place-items-center rounded-md bg-primary text-primary-foreground shadow-[0_0_18px_rgba(156,124,255,.28)]">
          <Sparkles className="size-3.5" />
        </div>
        <span>forge</span>
        <span className="text-[9px] tracking-widest text-muted-foreground uppercase">
          cloud
        </span>
        <button type="button" onClick={onClose} className="ml-auto md:hidden">
          <X className="size-4 text-muted-foreground" />
        </button>
      </div>

      <p className="mt-6 mb-2 px-2.5 text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        Workspace
      </p>
      <nav className="flex flex-col gap-0.5">
        {navigation.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (label === "Projects" && pathname.startsWith("/projects/"))
          return (
            <button
              key={href}
              type="button"
              onClick={() => go(href)}
              className={[
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="size-4" />
              {label}
            </button>
          )
        })}
      </nav>

      <div className="mt-7 mb-2 flex items-center justify-between px-2.5 text-[9px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        <span>Your projects</span>
        <button
          type="button"
          onClick={() => go("/projects/new")}
          aria-label="Create project"
        >
          <Plus className="size-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-0.5">
        {projectsQuery.isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse items-center gap-2 px-3 py-2"
            >
              <span className="size-1.5 shrink-0 rounded-full bg-muted" />
              <span className="h-2.5 w-24 rounded bg-muted" />
            </div>
          ))}

        {!projectsQuery.isLoading &&
          !projectsQuery.isError &&
          projectNames.length === 0 && (
            <p className="px-3 py-2 text-[11px] text-muted-foreground">
              No projects yet.
            </p>
          )}

        {projectNames.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => go(`/projects/${project.id}`)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate">{project.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-0.5">
        <button
          type="button"
          onClick={() => go("/docs")}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <LifeBuoy className="size-4" />
          Documentation
        </button>
        <button
          type="button"
          onClick={() => go("/settings")}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Settings2 className="size-4" />
          Settings
        </button>
        <div className="mt-2 flex items-center gap-2 border-t border-border px-2 py-3">
          <UserAvatar user={user} className="size-7 text-sm" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <strong className="truncate text-[11px]">
              {displayNameFor(user)}
            </strong>
            <small className="truncate text-sm text-muted-foreground">
              {user.email ?? ""}
            </small>
          </span>
        </div>
      </div>
    </aside>
  )
}
