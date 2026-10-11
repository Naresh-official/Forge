/**
 * Fluent Bit "Forward" protocol receiver (msgpack over TCP).
 *
 * Fluent Bit's `forward` output in the default MessagePack mode sends a bare
 * msgpack **stream** — no length prefix, no delimiter. A single TCP read can
 * contain one value, several values, or a prefix of one value, and the same
 * value can be split across reads. Message shape:
 *
 *   1. ["tag", [[time, record], ...]]             — plain (default)
 *   2. ["tag", [[time, record], ...], {options}]  — Send_options on
 *   3. { tag: "t", event: [[time, record], ...] } — option-forwarding mode
 *
 * The receiver therefore has to decode a stream and keep whatever is left
 * over. msgpackr's `unpackMultiple` does exactly that: when the buffer holds
 * only part of the next value it throws an error carrying `incomplete`,
 * `values` (everything decoded so far) and `lastPosition` (where the
 * undecodable value starts).
 *
 * ⚠️ The previous implementation assumed a 4-byte big-endian length prefix,
 * which Fluent Bit does not send. It read the first four bytes (`92 b1 6b 75`)
 * as a ~2.4 GB frame length, buffered every subsequent byte as "incomplete"
 * and silently dropped all runtime logs. Only the compressed Forward mode is
 * length-prefixed, and nothing here enables it.
 */

import { Unpackr, addExtension } from "msgpackr"

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
  /**
   * Reports undecodable streams and handler failures. Injected by the caller
   * so this module stays free of a logger dependency.
   */
  onError?: (error: unknown) => void
}

export type ForwardMessageHandler = (
  message: ForwardMessage
) => void | Promise<void>

/** Extension type Fluent Bit uses to pack `EventTime`. */
const FLUENT_BIT_EVENT_TIME_EXT = 0

/*
 * Fluent Bit packs EventTime as a fixext8 whose payload is uint32 seconds
 * followed by uint32 nanoseconds (both big-endian), under msgpack extension
 * type 0. msgpackr ships a no-op handler for type 0 (it uses the same code
 * for `undefined` when packing), so without this the event time decodes as
 * `undefined` and every log line loses its real timestamp.
 *
 * The log-router only unpacks, so overriding the type-0 handler is safe.
 */
addExtension({
  type: FLUENT_BIT_EVENT_TIME_EXT,
  unpack(buffer: Uint8Array) {
    if (buffer.byteLength !== 8) {
      return undefined
    }

    const view = new DataView(
      buffer.buffer,
      buffer.byteOffset,
      buffer.byteLength
    )

    const seconds = view.getUint32(0, false)
    const nanoseconds = view.getUint32(4, false)

    return new Date(seconds * 1000 + nanoseconds / 1_000_000)
  },
})

const unpacker = new Unpackr({ useRecords: false })

/** A decoded value that is not a recognizable Forward message. */
interface DecodeResult {
  messages: ForwardMessage[]
  /** Bytes of an incomplete trailing value, carried to the next read. */
  rest: Uint8Array
  /** Set when the stream could not be decoded at all (buffer was reset). */
  error?: unknown
}

/**
 * Upper bound on undecoded bytes held per connection. A real Fluent Bit
 * message is a few hundred KB at most; anything past this means the stream is
 * not what we think it is, and dropping it beats growing without limit.
 */
const MAX_PENDING_BYTES = 8 * 1024 * 1024

/**
 * Decodes as many complete Forward messages as `buffer` holds, returning the
 * unrecognized trailing bytes so the caller can prepend them to the next read.
 * Only genuinely undecodable streams raise — partial data is normal.
 */
export function decodeForwardMessages(buffer: Uint8Array): DecodeResult {
  let values: unknown[]

  try {
    values = unpacker.unpackMultiple(buffer)
    return { messages: toForwardMessages(values), rest: EMPTY }
  } catch (error) {
    const incomplete = error as {
      incomplete?: boolean
      lastPosition?: number
      values?: unknown[]
    }

    if (!incomplete.incomplete) {
      // The stream itself is unrecognizable — there is no way to resynchronize
      // a delimiter-free format, so the pending bytes are dropped.
      return { messages: [], rest: EMPTY, error }
    }

    const position = incomplete.lastPosition

    return {
      messages: toForwardMessages(incomplete.values ?? []),
      rest:
        typeof position === "number" && position < buffer.byteLength
          ? buffer.slice(position)
          : EMPTY,
    }
  }
}

function toForwardMessages(values: unknown[]): ForwardMessage[] {
  const messages: ForwardMessage[] = []

  for (const value of values) {
    const message = toForwardMessage(value)

    if (message) {
      messages.push(message)
    }
  }

  return messages
}

/** Normalizes one decoded msgpack value into a Forward message. */
export function toForwardMessage(value: unknown): ForwardMessage | undefined {
  // Shape 3: { tag, event, option }
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "tag" in value
  ) {
    const shape = value as {
      tag: unknown
      event?: unknown
      option?: unknown
    }

    if (typeof shape.tag !== "string") {
      return undefined
    }

    return {
      tag: shape.tag,
      records: decodeEntries(shape.event),
      ...(shape.option !== undefined ? { options: shape.option } : {}),
    }
  }

  // Shapes 1 and 2: ["tag", entries[, options]]
  if (Array.isArray(value) && value.length >= 2) {
    const [tag, entries, options] = value as [unknown, unknown, unknown?]

    if (typeof tag !== "string") {
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

function decodeEntries(entries: unknown): ForwardRecord[] {
  const records: ForwardRecord[] = []

  if (!Array.isArray(entries)) {
    return records
  }

  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length < 2) continue

    const [time, record] = entry

    if (typeof record === "object" && record !== null) {
      records.push({
        timestamp: normalizeTimestamp(time),
        record: record as Record<string, unknown>,
      })
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

/**
 * Minimal listener surface used here. `ReturnType<typeof Bun.listen>` resolves
 * to the *unix socket* overload of the overloaded API, so the field is typed
 * structurally instead of by the helper type.
 */
interface TcpListener {
  stop(closeActiveConnections?: boolean): void
}

interface ConnectionState {
  /** Bytes received but not yet decoded into a complete message. */
  buffer: Uint8Array
  /**
   * Serializes async handling per connection. Bun does not await socket
   * callbacks, so without this a slow handler could let the next read's
   * messages overtake this one's.
   */
  chain: Promise<void>
}

const EMPTY = new Uint8Array(0)

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.byteLength === 0) {
    return b.slice()
  }

  if (b.byteLength === 0) {
    return a
  }

  const out = new Uint8Array(a.byteLength + b.byteLength)
  out.set(a, 0)
  out.set(b, a.byteLength)

  return out
}

export class ForwardServer {
  private readonly options: ForwardServerOptions
  private readonly handler: ForwardMessageHandler
  private server: TcpListener | undefined

  constructor(options: ForwardServerOptions, handler: ForwardMessageHandler) {
    this.options = options
    this.handler = handler
  }

  listen(): void {
    const connections = new Map<object, ConnectionState>()
    const handler = this.handler
    const onError = this.options.onError

    this.server = Bun.listen({
      hostname: this.options.host,
      port: this.options.port,
      socket: {
        open(socket) {
          connections.set(socket, { buffer: EMPTY, chain: Promise.resolve() })
        },
        data(socket, data) {
          const state = connections.get(socket)

          if (!state) return

          const decoded = decodeForwardMessages(
            concat(state.buffer, new Uint8Array(data))
          )

          state.buffer = decoded.rest

          if (decoded.error) {
            onError?.(decoded.error)
          }

          if (decoded.messages.length === 0) {
            if (state.buffer.byteLength > MAX_PENDING_BYTES) {
              onError?.(
                new Error(
                  `Dropping ${state.buffer.byteLength} undecodable Forward bytes`
                )
              )
              state.buffer = EMPTY
            }

            return
          }

          state.chain = state.chain
            .then(async () => {
              // Messages inside one read are always in order.
              for (const message of decoded.messages) {
                try {
                  await handler(message)
                } catch (error) {
                  onError?.(error)
                }
              }
            })
            .catch((error) => onError?.(error))
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
