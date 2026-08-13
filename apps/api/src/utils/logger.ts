import pino from "pino"
import fs from "node:fs"
import path from "node:path"

const LOG_RETENTION_DAYS = 5

const logRoot = path.resolve(process.cwd(), "logs")

function formatDate(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
}

function formatTime(date: Date) {
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    const seconds = String(date.getSeconds()).padStart(2, "0")

    return `${hours}-${minutes}-${seconds}`
}

function cleanupOldLogs() {
    if (!fs.existsSync(logRoot)) {
        return
    }

    const cutoff = new Date()

    cutoff.setHours(0, 0, 0, 0)
    cutoff.setDate(cutoff.getDate() - LOG_RETENTION_DAYS)

    for (const entry of fs.readdirSync(logRoot, {
        withFileTypes: true,
    })) {
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

function createLogFile() {
    const now = new Date()

    const dateFolder = formatDate(now)
    const time = formatTime(now)

    const dayLogDir = path.join(logRoot, dateFolder)

    fs.mkdirSync(dayLogDir, {
        recursive: true,
    })

    const fileName = `server-${time}-${process.pid}.log`

    return path.join(dayLogDir, fileName)
}

// Cleanup happens once when the server starts
cleanupOldLogs()

const logFile = createLogFile()

const fileStream = pino.destination({
    dest: logFile,
    sync: false,
})

const terminalStream = pino.transport({
    target: "pino-pretty",
    options: {
        colorize: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname",
        messageFormat: "{msg}",
    },
})

const logger = pino(
    {
        level: process.env.LOG_LEVEL || "info",
    },
    pino.multistream([
        {
            level: "info",
            stream: terminalStream,
        },
        {
            level: "info",
            stream: fileStream,
        },
    ])
)

logger.info(`Log file: ${logFile}`)

export default logger
