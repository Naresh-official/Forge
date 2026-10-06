import type { Request, Response } from "express"
import { ApiError } from "@forge/types/apiResponses"
import { handleErrors } from "@/utils/handleErrors"
import logger from "@/utils/logger"
import {
  assertDeploymentAccess,
  getDeploymentLogsService,
} from "./logs.service"
import { subscribeToDeploymentLogs } from "./logs.redis"
import type { LogEvent } from "@forge/types/logs"

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const

/** Reconnect hint for the browser's EventSource. */
const SSE_RETRY_MS = 3_000
/** Interval for SSE comment keepalives (defeats proxy idle timeouts). */
const SSE_KEEPALIVE_MS = 15_000

function sseWrite(
  res: Response,
  event: string,
  data: unknown,
  id?: string | number
): void {
  // Only emit an id when one exists — `id: undefined` would become the
  // browser's Last-Event-ID for reconnects.
  if (id !== undefined) {
    res.write(`id: ${id}\n`)
  }

  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
}

/**
 * GET /deployments/:deploymentId/logs/stream
 *
 * Bridges the deployment's Redis log channel to the browser over SSE.
 * Requires the same session cookie as every other authenticated endpoint —
 * EventSource sends cookies for same-origin and credentialed requests.
 */
export const streamDeploymentLogs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const deploymentId = req.params.deploymentId

    if (!deploymentId) {
      throw new ApiError(400, "Deployment ID is required")
    }

    // Authorization before any streaming begins.
    await assertDeploymentAccess(deploymentId, userId)

    res.status(200)
    res.set(SSE_HEADERS)
    res.flushHeaders()

    // Comment line — keeps intermediaries from closing an idle stream and
    // tells the client the bridge is alive.
    res.write(": connected\n\n")
    sseWrite(res, "retry", { retryMs: SSE_RETRY_MS })

    let open = true
    let lastEventId = 0

    const send = (event: string, data: unknown, id?: string | number) => {
      if (!open) return
      // A write after the socket died throws — normalize it to a close.
      try {
        sseWrite(res, event, data, id)
      } catch {
        open = false
      }
    }

    const unsubscribe = await subscribeToDeploymentLogs(
      deploymentId,
      (event: LogEvent) => {
        send("log", event, ++lastEventId)
      }
    )

    // Replay history captured when the subscription attached.
    for (const event of unsubscribe.history) {
      send("log", event, ++lastEventId)
    }

    send("ready", { deploymentId })

    const keepalive = setInterval(() => {
      if (!open) return
      try {
        res.write(": keepalive\n\n")
      } catch {
        open = false
      }
    }, SSE_KEEPALIVE_MS)

    const close = () => {
      if (!open) return

      open = false
      clearInterval(keepalive)

      // Cleanup must never break the request teardown.
      try {
        unsubscribe[Symbol.dispose]()
      } catch (error) {
        logger.warn(
          { error },
          "[logs-sse] Failed to release Redis subscription"
        )
      }

      logger.info(
        { deploymentId },
        "[logs-sse] Client disconnected, Redis subscription released"
      )

      try {
        res.end()
      } catch {
        // Socket already gone.
      }
    }

    req.on("close", close)
    res.on("close", close)
    req.on("aborted", close)
  } catch (error) {
    handleErrors(res, error)
  }
}

/**
 * GET /deployments/:deploymentId/logs
 *
 * Paginated historical logs from S3 (build or runtime).
 */
export const getDeploymentLogs = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id

    if (!userId) {
      throw new ApiError(401, "Unauthorized")
    }

    const deploymentId = req.params.deploymentId

    if (!deploymentId) {
      throw new ApiError(400, "Deployment ID is required")
    }

    const typeParam = req.query.type
    const type: "build" | "runtime" =
      typeParam === "runtime" ? "runtime" : "build"

    const cursor =
      typeof req.query.cursor === "string" && req.query.cursor.length > 0
        ? req.query.cursor
        : undefined

    const page = await getDeploymentLogsService({
      deploymentId,
      userId,
      type,
      cursor,
    })

    return res.status(200).json({
      success: true,
      message: "Logs fetched successfully",
      data: page,
    })
  } catch (error) {
    handleErrors(res, error)
  }
}
