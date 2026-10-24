"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  getDeploymentLogs,
  streamDeploymentLogs,
  type DeploymentLogStream,
} from "@forge/api-client/logs"
import type { LogEvent, LogLine } from "@forge/types/logs"

export type DeploymentLogType = "build" | "runtime"

export interface UseDeploymentLogsOptions {
  deploymentId: string
  /** "build" (default) or "runtime". */
  type?: DeploymentLogType
  /** Set false to keep only historical logs (no live connection). */
  live?: boolean
}

export interface UseDeploymentLogsResult {
  /** Historical + live lines for the selected type, oldest first. */
  lines: LogLine[]
  isLoading: boolean
  isError: boolean
  error: unknown
  /** True while the SSE channel is connected. */
  isLiveConnected: boolean
  /**
   * True once any runtime output has been observed for this deployment
   * (historical or live). Used to auto-switch off the build tab once the
   * application starts producing logs.
   */
  hasRuntimeLogs: boolean
  /** True when older pages exist and can be fetched. */
  hasMore: boolean
  /** Fetches the next (older) page from S3. */
  loadMore: () => void
  refetch: () => void
}

/**
 * Merges historical logs (TanStack Query, paginated S3 retrieval) with live
 * events (a dedicated SSE connection — intentionally not a TanStack Query,
 * which is a request/response cache, not a push channel).
 *
 * The SSE channel is *deployment*-scoped and carries both build and runtime
 * events, so switching the log type must never tear it down or drop the live
 * buffer — it only changes which `source` is displayed. Tearing it down used
 * to wipe the buffer and show "No logs yet" for both tabs.
 */
export function useDeploymentLogs(
  options: UseDeploymentLogsOptions
): UseDeploymentLogsResult {
  const { deploymentId, type = "build", live = true } = options

  const [liveLines, setLiveLines] = useState<LogLine[]>([])
  const [isLiveConnected, setIsLiveConnected] = useState(false)
  const [cursorStack, setCursorStack] = useState<string[]>([])

  const historyQuery = useQuery({
    queryKey: ["deployment-logs", deploymentId, type],
    queryFn: () => getDeploymentLogs(deploymentId, type),
  })

  const olderPageQuery = useQuery({
    queryKey: ["deployment-logs", deploymentId, type, cursorStack],
    queryFn: () => getDeploymentLogs(deploymentId, type, cursorStack.at(-1)),
    enabled: cursorStack.length > 0,
  })

  /*
   * Reset per-deployment state only. `type` is deliberately excluded: the
   * live buffer holds events for the whole deployment and is filtered for
   * display, so switching tabs keeps whatever has already streamed in.
   *
   * This runs during render (React's "adjust state when a prop changes"
   * pattern) instead of in an effect, so the previous deployment's buffer is
   * never rendered for the new one.
   */
  const [bufferedDeploymentId, setBufferedDeploymentId] = useState(deploymentId)
  if (bufferedDeploymentId !== deploymentId) {
    setBufferedDeploymentId(deploymentId)
    setLiveLines([])
    setIsLiveConnected(false)
    setCursorStack([])
  }

  const streamRef = useRef<DeploymentLogStream | undefined>(undefined)

  useEffect(() => {
    if (!live) return

    const stream = streamDeploymentLogs(deploymentId, {
      onLog: (event: LogEvent) => {
        setLiveLines((previous) => [...previous, toLine(event)])
      },
      onReady: () => setIsLiveConnected(true),
      onError: () => setIsLiveConnected(false),
    })

    streamRef.current = stream

    return () => {
      stream.close()
      streamRef.current = undefined
    }
  }, [deploymentId, live])

  const lines = useMemo(() => {
    const historical = [
      ...(historyQuery.data?.data.lines ?? []),
      ...(olderPageQuery.data?.data.lines ?? []),
    ]

    return mergeLogLines(historical, liveLines, type)
  }, [historyQuery.data, olderPageQuery.data, liveLines, type])

  /*
   * Live events carry both sources regardless of the selected tab, so this
   * flips as soon as the running application emits its first log line.
   */
  const hasRuntimeLogs = useMemo(
    () => liveLines.some((line) => line.source === "runtime"),
    [liveLines]
  )

  const hasMore =
    olderPageQuery.data?.data.hasMore ??
    historyQuery.data?.data.hasMore ??
    false

  const loadMore = () => {
    const nextCursor =
      olderPageQuery.data?.data.nextCursor ?? historyQuery.data?.data.nextCursor

    if (nextCursor) {
      setCursorStack((previous) =>
        previous.includes(nextCursor) ? previous : [...previous, nextCursor]
      )
    }
  }

  return {
    lines,
    isLoading: historyQuery.isLoading,
    isError: historyQuery.isError,
    error: historyQuery.error,
    isLiveConnected,
    hasRuntimeLogs,
    hasMore,
    loadMore,
    refetch: () => historyQuery.refetch(),
  }
}

function toLine(event: LogEvent): LogLine {
  return {
    timestamp: event.timestamp,
    level: event.level,
    source: event.source,
    message: event.message,
    ...(event.kubernetes ? { kubernetes: event.kubernetes } : {}),
  }
}

/**
 * Selects the lines for `type`, removes duplicates (a reconnect replays Redis
 * history, which overlaps with events already buffered and with S3 history),
 * and sorts oldest-first. Exported for testing.
 */
export function mergeLogLines(
  historical: LogLine[],
  live: LogLine[],
  type: DeploymentLogType
): LogLine[] {
  const seen = new Set<string>()
  const merged: LogLine[] = []

  for (const line of [...historical, ...live]) {
    if (line.source !== type) {
      continue
    }

    const key = `${line.timestamp}|${line.source}|${line.message}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    merged.push(line)
  }

  return merged.sort(
    (a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0)
  )
}
