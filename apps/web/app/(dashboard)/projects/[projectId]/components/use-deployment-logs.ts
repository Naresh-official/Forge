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
  /** Historical + live lines merged, oldest first. */
  lines: LogLine[]
  isLoading: boolean
  isError: boolean
  error: unknown
  /** True while the SSE channel is connected. */
  isLiveConnected: boolean
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
 * Live events are also written into the query cache so switching between
 * deployments keeps them.
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

  // Reset live state when switching deployments or log type.
  useEffect(() => {
    setLiveLines([])
    setIsLiveConnected(false)
  }, [deploymentId, type])

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
  }, [deploymentId, type, live])

  const lines = useMemo(() => {
    const historical = [
      ...(historyQuery.data?.data.lines ?? []),
      ...(olderPageQuery.data?.data.lines ?? []),
    ]

    // Oldest page first: pages were fetched newest-first, so accumulated
    // cursors are in newest→oldest order — reverse the chunk lines? Pages
    // themselves are chronological per cursor; simplest correct merge is
    // historical then live, sorted by timestamp when both exist.
    const merged = [...historical, ...liveLines]

    return merged
  }, [historyQuery.data, olderPageQuery.data, liveLines])

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
