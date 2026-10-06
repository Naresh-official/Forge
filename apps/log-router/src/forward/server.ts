/**
 * Minimal Fluent Bit "Forward" protocol receiver (msgpack over TCP).
 *
 * Fluent Bit's forward output emits length-prefixed msgpack frames:
 *   [4-byte big-endian total length][msgpack payload]
 *
 * Payload shapes (all handled):
 *   1. ["tag", [[time, map], ...]]             — plain array
 *   2. { tag: "t", event: [[time, map], ...] } — option-forwarding mode
 *   3. ["tag", [[time, map], ...], {opts}]     — with options
 *
 * Only the subset needed for log forwarding is decoded — entries are
 * [timestamp, record] pairs whose records come from the kubernetes filter.
 */

import { decode } from "msgpackr"

export interface ForwardRecord {
  timestamp: number
  record: Record<string, unknown>
}

export interface ForwardMessage {
  tag: string
  records: ForwardRecord[]
  /** Optional per-message options (chunk etc.) sent by Fluent Bit. */
  options?: unknown
}

export interface ForwardServerOptions {
  port: number
  host: string
}

export type ForwardMessageHandler = (
  message: ForwardMessage
) => void | Promise<void>

interface ConnectionState {
  buffer: Uint8Array
  expectedLength: number | null
}

export class ForwardServer {
  private readonly options: ForwardServerOptions
  private readonly handler: ForwardMessageHandler
  private server: ReturnType<typeof Bun.listen> | undefined

  constructor(options: ForwardServerOptions, handler: ForwardMessageHandler) {
    this.options = options
    this.handler = handler
  }

  listen(): void {
    const connections = new Map<object, ConnectionState>()
    const handler = this.handler

    this.server = Bun.listen({
      hostname: this.options.host,
      port: this.options.port,
      socket: {
        open(socket) {
          connections.set(socket, {
            buffer: new Uint8Array(0),
            expectedLength: null,
          })
        },
        async data(socket, data) {
          const state = connections.get(socket)

          if (!state) return

          let pending = state.buffer.byteLength
            ? concat(state.buffer, data)
            : data

          while (pending.byteLength > 0) {
            if (state.expectedLength === null) {
              if (pending.byteLength < 4) {
                state.buffer = pending
                return
              }

              const view = new DataView(
                pending.buffer,
                pending.byteOffset,
                pending.byteLength
              )

              state.expectedLength = view.getUint32(0, false)
              pending = pending.subarray(4)
            }

            if (pending.byteLength < state.expectedLength) {
              state.buffer = pending
              return
            }

            const frame = pending.subarray(0, state.expectedLength)
            pending = pending.subarray(state.expectedLength)
            state.expectedLength = null

            try {
              const message = decodeFrame(frame)

              if (message) {
                await handler(message)
              } else {
                console.error(
                  "[log-router] decodeFrame returned undefined for frame:",
                  frame.length,
                  "bytes"
                )
              }
            } catch (err) {
              // Malformed frame — drop it, keep the connection.
              console.error("[log-router] Frame decode/handle error:", err)
            }
          }

          state.buffer = new Uint8Array(0)
        },
        close(socket) {
          connections.delete(socket)
        },
        error(socket) {
          connections.delete(socket)
        },
      },
    })
  }

  close(): void {
    this.server?.stop(true)
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(a, 0)
  out.set(b, a.byteLength)

  return out
}

interface ForwardEntry extends Array<unknown> {}

export function decodeFrame(frame: Uint8Array): ForwardMessage | undefined {
  const decoded = decode(frame) as unknown

  // Shape 2: { tag, event, option }
  if (
    typeof decoded === "object" &&
    decoded !== null &&
    !Array.isArray(decoded) &&
    "tag" in decoded
  ) {
    const shape = decoded as {
      tag: string
      event: ForwardEntry[]
      option?: unknown
    }

    return {
      tag: shape.tag,
      records: decodeEntries(shape.event ?? []),
      ...(shape.option ? { options: shape.option } : {}),
    }
  }

  // Shapes 1 and 3: ["tag", entries[, options]]
  if (Array.isArray(decoded) && decoded.length >= 2) {
    const [tag, entries, options] = decoded as [
      string,
      ForwardEntry[],
      unknown?,
    ]

    if (typeof tag !== "string" || !Array.isArray(entries)) {
      return undefined
    }

    return {
      tag,
      records: decodeEntries(entries),
      ...(options !== undefined ? { options } : {}),
    }
  }

  return undefined
}

function decodeEntries(entries: ForwardEntry[]): ForwardRecord[] {
  const records: ForwardRecord[] = []

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue

    const [time, record] = entry

    const timestamp = normalizeTimestamp(time)

    if (typeof record === "object" && record !== null) {
      records.push({ timestamp, record: record as Record<string, unknown> })
    }
  }

  return records
}

function normalizeTimestamp(time: unknown): number {
  if (typeof time === "number") {
    // Fluent Bit forwards EventTime as seconds float.
    return time
  }

  if (time instanceof Date) {
    return time.getTime() / 1000
  }

  if (typeof time === "object" && time !== null && "$number" in time) {
    // msgpackr ext form for high-precision timestamps.
    return Number((time as { $number: number }).$number)
  }

  return Date.now() / 1000
}
