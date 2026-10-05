import fs from "node:fs"
import path from "node:path"
import pino from "pino"
import type { Level, Logger, LoggerOptions, StreamEntry } from "pino"

/** Number of daily log folders kept per service by default. */
const DEFAULT_RETENTION_DAYS = 5

export interface CreateLoggerOptions {
  /**
   * Service name. Logs are written to `<workspaceRoot>/logs/<service>/`.
   * Sanitized to a path-safe value.
   */
  service: string
  /** Pino log level. Defaults to `"info"`. */
  level?: LoggerOptions["level"]
  /** Number of daily log folders to keep. Defaults to `5`. */
  retentionDays?: number
  /**
   * Pretty-print logs to the terminal with `pino-pretty`. Defaults to `true`;
   * set to `false` to emit raw NDJSON to stdout instead.
   */
  pretty?: boolean
}

/**
 * Walk up from `startDir` until the monorepo workspace root (the directory
 * holding `turbo.json`, `bun.lock` or `pnpm-workspace.yaml`) is found.
 */
export function findWorkspaceRoot(startDir: string): string {
  let current = startDir

  while (true) {
    const parent = path.dirname(current)

    if (parent === current) {
      return startDir
    }

    if (
      fs.existsSync(path.join(current, "turbo.json")) ||
      fs.existsSync(path.join(current, "bun.lock")) ||
      fs.existsSync(path.join(current, "pnpm-workspace.yaml"))
    ) {
      return current
    }

    current = parent
  }
}

function resolveStartDir(): string {
  return (
    import.meta.dirname ??
    (typeof import.meta.url !== "undefined"
      ? path.dirname(new URL(import.meta.url).pathname)
      : process.cwd())
  )
}

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${hours}-${minutes}-${seconds}`
}

function cleanupOldLogs(logRoot: string, retentionDays: number): void {
  if (!fs.existsSync(logRoot)) {
    return
  }

  const cutoff = new Date()

  cutoff.setHours(0, 0, 0, 0)
  cutoff.setDate(cutoff.getDate() - retentionDays)

  for (const entry of fs.readdirSync(logRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue
    }

    // Only process YYYY-MM-DD directories
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.name)) {
      continue
    }

    const folderDate = new Date(`${entry.name}T00:00:00`)

    if (folderDate < cutoff) {
      fs.rmSync(path.join(logRoot, entry.name), {
        recursive: true,
        force: true,
      })
    }
  }
}

function createLogFile(logRoot: string, service: string): string {
  const now = new Date()

  const dayLogDir = path.join(logRoot, formatDate(now))

  fs.mkdirSync(dayLogDir, {
    recursive: true,
  })

  const fileName = `${service}-${formatTime(now)}-${process.pid}.log`

  return path.join(dayLogDir, fileName)
}

/**
 * Creates a pino logger that writes to both the terminal and a dated log file
 * under `<workspaceRoot>/logs/<service>/YYYY-MM-DD/`. Old daily folders beyond
 * the retention window are pruned once at creation time.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const service = options.service.replace(/[^a-zA-Z0-9_-]/g, "-")
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS

  const workspaceRoot = findWorkspaceRoot(resolveStartDir())
  const logRoot = path.join(workspaceRoot, "logs", service)

  cleanupOldLogs(logRoot, retentionDays)

  const logFile = createLogFile(logRoot, service)

  const fileStream = pino.destination({
    dest: logFile,
    sync: false,
  })

  const consoleStream: StreamEntry =
    options.pretty === false
      ? {
          level: "debug" as Level,
          stream: process.stdout,
        }
      : {
          level: "debug" as Level,
          stream: pino.transport({
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss",
              ignore: "pid,hostname",
              messageFormat: "{msg}",
            },
          }),
        }

  const logger = pino(
    {
      level: options.level ?? "info",
    },
    pino.multistream([
      // Debug and above → terminal
      consoleStream,

      // Info and above → log file
      {
        level: "info",
        stream: fileStream,
      },
    ])
  )

  logger.info(`Log file: ${logFile}`)

  return logger
}
