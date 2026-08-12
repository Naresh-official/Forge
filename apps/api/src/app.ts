import express from "express"
import type { Express } from "express"

// importing routers

import authRouter from "@/features/auth/auth.routes"
import { apiConfig } from "@workspace/config"

const app: Express = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Logger middleware

app.use((req, res, next) => {
    const timestamp = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).format(new Date())
    console.log(`[${timestamp}] ${req.method} ${req.url}`)
    if (apiConfig.nodeEnv === "development") {
        console.log("Request Body:", req.body)
    }
    next()
})

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

app.use("/api/v1/auth", authRouter)

export default app
