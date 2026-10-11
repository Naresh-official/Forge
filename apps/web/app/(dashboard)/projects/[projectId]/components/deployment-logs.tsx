"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Copy, RefreshCw, Terminal } from "lucide-react"
import type { DeploymentStatus } from "@forge/types"
import { Badge } from "@forge/ui/components/badge"
import { Button } from "@forge/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@forge/ui/components/card"
import { Tabs, TabsList, TabsTrigger } from "@forge/ui/components/tabs"
import { cn } from "@forge/ui/lib/utils"
import {
  useDeploymentLogs,
  type DeploymentLogType,
} from "./use-deployment-logs"

/** Deployment states in which the application is up and serving traffic. */
export function isDeploymentRunning(status?: DeploymentStatus): boolean {
  return status === "READY"
}

/**
 * Tab to open with. An explicit `initialType` wins; otherwise a running
 * deployment opens on runtime logs and everything else on build logs.
 */
export function initialLogType(
  initialType: DeploymentLogType | undefined,
  status?: DeploymentStatus
): DeploymentLogType {
  return initialType ?? (isDeploymentRunning(status) ? "runtime" : "build")
}

/**
 * Tab to move to as status/output changes. Switches to runtime once the
 * deployment is running or emitting runtime output; otherwise stays put.
 */
export function autoLogType(
  current: DeploymentLogType,
  status: DeploymentStatus | undefined,
  hasRuntimeLogs: boolean
): DeploymentLogType {
  return isDeploymentRunning(status) || hasRuntimeLogs ? "runtime" : current
}

const LEVEL_COLORS: Record<string, string> = {
  info: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-rose-400",
}

const LEVEL_LABELS: Record<string, string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
}

function formatTime(timestamp: string): string {
  if (!timestamp) return "--:--:--"

  const date = new Date(timestamp)

  if (isNaN(date.getTime())) return "--:--:--"

  return date.toLocaleTimeString("en-GB", { hour12: false })
}

export function DeploymentLogs({
  deploymentId,
  initialType,
  status,
}: {
  deploymentId: string
  initialType?: DeploymentLogType
  /** Current deployment status; drives the automatic build→runtime switch. */
  status?: DeploymentStatus
}) {
  // Open an already-running deployment on its runtime logs; everything else
  // (queued/building/failed/cancelled) starts on the build logs.
  const [type, setType] = useState<DeploymentLogType>(() =>
    initialLogType(initialType, status)
  )
  const [autoScroll, setAutoScroll] = useState(true)

  // Set once the user picks a tab, so the automatic switch never yanks them
  // away from the view they deliberately chose.
  const userPinnedType = useRef(false)

  const {
    lines,
    isLoading,
    isError,
    error,
    isLiveConnected,
    hasRuntimeLogs,
    hasMore,
    loadMore,
    refetch,
  } = useDeploymentLogs({ deploymentId, type })

  /*
   * Follow the deployment into runtime once it is ready and actually
   * producing output. Two triggers, because they cover different cases:
   * `status` handles an already-running deployment (and status refreshes),
   * while `hasRuntimeLogs` handles a build that finishes while this view is
   * open — the deployments list is not polled, so the live stream is the
   * signal that the application has started.
   */
  useEffect(() => {
    if (userPinnedType.current) return

    setType((current) => autoLogType(current, status, hasRuntimeLogs))
  }, [status, hasRuntimeLogs])

  const selectType = (value: DeploymentLogType) => {
    userPinnedType.current = true
    setType(value)
  }

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [lines, autoScroll])

  const handleScroll = () => {
    const element = scrollRef.current

    if (!element) return

    const atBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 40

    setAutoScroll(atBottom)
  }

  const hasKubernetesMetadata = useMemo(
    () => lines.some((line) => line.kubernetes !== undefined),
    [lines]
  )

  return (
    <Card className="[--card-spacing:--spacing(4.5)]">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <CardTitle className="text-xs">Logs</CardTitle>
          <Badge
            variant="outline"
            className={cn(
              "ml-1 gap-1.5 rounded-full px-2 py-0.5 text-[9px] uppercase",
              isLiveConnected
                ? "border-emerald-500/30 text-emerald-400"
                : "border-border text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                isLiveConnected ? "bg-emerald-400" : "bg-muted-foreground"
              )}
            />
            {isLiveConnected ? "Live" : "Offline"}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={type}
            onValueChange={(value) => selectType(value as DeploymentLogType)}
          >
            <TabsList className="h-auto gap-0 border border-border p-0">
              {(["build", "runtime"] as const).map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="rounded-none px-2.5 py-1 text-[10px] capitalize data-active:bg-primary data-active:text-primary-foreground"
                >
                  {value}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Refetch logs"
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Copy logs"
            onClick={() =>
              navigator.clipboard?.writeText(
                lines
                  .map(
                    (line) =>
                      `${formatTime(line.timestamp)}  ${LEVEL_LABELS[line.level] ?? "INFO"}  ${line.message}`
                  )
                  .join("\n")
              )
            }
            className="text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {hasMore && (
          <Button
            type="button"
            variant="ghost"
            onClick={loadMore}
            className="mt-3 w-full border border-dashed border-border py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Load older logs
          </Button>
        )}

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="mt-3 max-h-96 overflow-auto rounded-md border border-border bg-background p-3"
        >
          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading logs…</p>
          )}

          {!isLoading && isError && (
            <p className="text-sm text-rose-400">
              Failed to load logs
              {error instanceof Error ? `: ${error.message}` : ""}
            </p>
          )}

          {!isLoading && !isError && lines.length === 0 && (
            <p className="text-sm text-muted-foreground">No logs yet.</p>
          )}

          {!isLoading &&
            !isError &&
            lines.map((line, index) => (
              <div
                key={`${line.timestamp}-${index}`}
                className="grid grid-cols-[66px_44px_1fr] gap-2.5 font-mono text-xs leading-[1.85] whitespace-nowrap"
              >
                <time className="text-muted-foreground">
                  {formatTime(line.timestamp)}
                </time>
                <span
                  className={cn(
                    "font-semibold",
                    LEVEL_COLORS[line.level] ?? "text-muted-foreground"
                  )}
                >
                  {LEVEL_LABELS[line.level] ?? "INFO"}
                </span>
                <code className="text-foreground/90">
                  {line.message}
                  {hasKubernetesMetadata && line.kubernetes && (
                    <span className="ml-2 text-[9px] text-muted-foreground">
                      [{line.kubernetes.pod ?? "pod"}
                      {line.kubernetes.container
                        ? `/${line.kubernetes.container}`
                        : ""}
                      ]
                    </span>
                  )}
                </code>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  )
}
