import type { GetDeploymentLogsResponse, LogEvent } from "@forge/types/logs"
import type { ApiResponse } from "@forge/types/apiResponses"
import { api, apiUrl } from "./client"

/**
 * Fetches one page of persisted logs for a deployment from the forge-logs
 * bucket via the API.
 *
 * @param type       "build" (build logs) or "runtime" (application logs)
 * @param cursor     continuation token from a previous page (`nextCursor`)
 */
export function getDeploymentLogs(
  deploymentId: string,
  type: "build" | "runtime" = "build",
  cursor?: string
): Promise<ApiResponse<GetDeploymentLogsResponse>> {
  const params = new URLSearchParams({ type })

  if (cursor) {
    params.set("cursor", cursor)
  }

  return api<ApiResponse<GetDeploymentLogsResponse>>(
    `/deployments/${deploymentId}/logs?${params.toString()}`
  )
}

export interface DeploymentLogStream {
  /** Live log events from the deployment's Redis channel. */
  onLog: (event: LogEvent) => void
  /** Fired after the connection is established (history was replayed). */
  onReady?: () => void
  /** Fired on connection loss; the stream auto-reconnects. */
  onError?: (error: Event) => void
  /** Closes the connection. */
  close: () => void
}

/**
 * Opens an SSE connection to the live log stream for a deployment.
 *
 * Kept deliberately separate from TanStack Query: SSE is a push channel,
 * not a request. On reconnect the server replays recent history from the
 * Redis ring buffer, so gaps are small; consumers should de-duplicate by
 * `timestamp + message` if exactness matters.
 */
export function streamDeploymentLogs(
  deploymentId: string,
  handlers: {
    onLog: (event: LogEvent) => void
    onReady?: () => void
    onError?: (error: Event) => void
  }
): DeploymentLogStream {
  const source = new EventSource(
    apiUrl(`/deployments/${deploymentId}/logs/stream`),
    { withCredentials: true }
  )

  source.addEventListener("log", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent).data) as LogEvent
      handlers.onLog(parsed)
    } catch {
      // Malformed frame — skip.
    }
  })

  source.addEventListener("ready", () => {
    handlers.onReady?.()
  })

  source.onerror = (event) => {
    handlers.onError?.(event)
  }

  return {
    onLog: handlers.onLog,
    onReady: handlers.onReady,
    onError: handlers.onError,
    close: () => source.close(),
  }
}
