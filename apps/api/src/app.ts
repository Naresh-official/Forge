import express from "express"
import type { Express } from "express"
import { apiConfig } from "@workspace/config"
import logger from "./utils/logger"
import cookieParser from "cookie-parser"
import cors from "cors"

// importing routers

import authRouter from "@/features/auth/auth.routes"
import githubRouter from "@/features/github/github.routes"
import repositoriesRouter from "@/features/repositories/repositories.routes"

const app: Express = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use(
    cors({
        origin: apiConfig.allowedOrigins,
        credentials: true,
    })
)

// Logger middleware

app.use((req, res, next) => {
    logger.info(
        {
            method: req.method,
            url: req.originalUrl,
            ip: req.ip,
        },
        "Incoming request"
    )

    if (apiConfig.nodeEnv === "development") {
        logger.debug(
            {
                body: req.body,
            },
            "Request body"
        )
    }

    next()
})

app.get("/api/v1/health", (req, res) => {
    res.status(200).json({ status: "ok" })
})

app.use("/api/v1/auth", authRouter)
app.use("/api/v1/github", githubRouter)
app.use("/api/v1/repositories", repositoriesRouter)

export default app
