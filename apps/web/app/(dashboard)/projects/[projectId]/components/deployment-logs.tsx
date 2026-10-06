"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Copy, RefreshCw, Terminal } from "lucide-react"
import {
  useDeploymentLogs,
  type DeploymentLogType,
} from "./use-deployment-logs"

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
  initialType = "build",
}: {
  deploymentId: string
  initialType?: DeploymentLogType
}) {
  const [type, setType] = useState<DeploymentLogType>(initialType)
  const [autoScroll, setAutoScroll] = useState(true)

  const {
    lines,
    isLoading,
    isError,
    error,
    isLiveConnected,
    hasMore,
    loadMore,
    refetch,
  } = useDeploymentLogs({ deploymentId, type })

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
    <article className="rounded-lg border border-border bg-card p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-muted-foreground" />
          <h2 className="text-xs font-semibold">Logs</h2>
          <span
            className={[
              "ml-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9px] uppercase",
              isLiveConnected
                ? "border-emerald-500/30 text-emerald-400"
                : "border-border text-muted-foreground",
            ].join(" ")}
          >
            <span
              className={[
                "size-1.5 rounded-full",
                isLiveConnected ? "bg-emerald-400" : "bg-muted-foreground",
              ].join(" ")}
            />
            {isLiveConnected ? "Live" : "Offline"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-border">
            {(["build", "runtime"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={[
                  "px-2.5 py-1 text-[10px] capitalize",
                  type === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                {value}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label="Refetch logs"
            onClick={() => refetch()}
            className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
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
            className="grid size-7 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            <Copy className="size-3.5" />
          </button>
        </div>
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="mt-3 w-full rounded-md border border-dashed border-border py-1.5 text-[10px] text-muted-foreground hover:text-foreground"
        >
          Load older logs
        </button>
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
                className={[
                  "font-semibold",
                  LEVEL_COLORS[line.level] ?? "text-muted-foreground",
                ].join(" ")}
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
    </article>
  )
}
