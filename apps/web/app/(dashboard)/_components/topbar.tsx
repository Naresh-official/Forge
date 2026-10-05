"use client"

import { Bell, CircleDot, Menu } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@forge/ui/components/button"
import { listProjectNames } from "@forge/api-client/project"
import { notifications } from "@/lib/forge-data"
import { UserAvatar, displayNameFor, type SessionUser } from "./user-avatar"

export type TopbarUser = SessionUser

/** Page titles for the routes that are not named after a path segment. */
const STATIC_TITLES: Record<string, string> = {
  "/dashboard": "Overview",
  "/projects": "Projects",
  "/projects/new": "New project",
  "/deployments": "Deployments",
  "/domains": "Domains",
  "/environments": "Environments",
  "/settings": "Settings",
}

export function Topbar({
  user,
  onMenu,
}: {
  user: TopbarUser
  onMenu: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const projectId = pathname.match(/^\/projects\/([^/]+)/)?.[1]
  const isProjectDetail = Boolean(projectId) && projectId !== "new"

  const projectNamesQuery = useQuery({
    queryKey: ["project-names"],
    queryFn: listProjectNames,
    enabled: isProjectDetail,
  })

  const title = (() => {
    if (isProjectDetail) {
      // Fall back to the segment while the name is still loading.
      return (
        projectNamesQuery.data?.data.find((p) => p.id === projectId)?.name ??
        projectId!
      )
    }

    return (
      STATIC_TITLES[pathname] ??
      (pathname.split("/").filter(Boolean).at(-1) || "Overview")
    )
  })()

  const displayName = displayNameFor(user)

  return (
    <header className="flex h-16 items-center justify-between border-b border-border px-[clamp(17px,4vw,50px)]">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onMenu}
          aria-label="Open navigation"
          className="md:hidden"
        >
          <Menu className="size-4" />
        </Button>
        <strong className="font-medium text-foreground">{title}</strong>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label="Theme"
        >
          <CircleDot className="size-4" />
        </Button>

        <div className="relative">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Notifications"
            onClick={() => setNotificationsOpen((v) => !v)}
            className="relative"
          >
            <Bell className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-1 rounded-full bg-rose-400" />
          </Button>
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

        <Button
          type="button"
          variant="outline"
          aria-label={`Account: ${displayName}`}
          onClick={() => router.push("/settings/profile")}
          className="h-8 gap-2 pr-2.5 pl-1"
        >
          <UserAvatar user={user} className="size-6" />
          <span className="max-w-32 truncate text-[11px] font-medium">
            {displayName}
          </span>
        </Button>
      </div>
    </header>
  )
}
