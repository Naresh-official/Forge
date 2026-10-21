import express from "express"
import type { Express } from "express"
import { apiConfig } from "@forge/config"
import logger from "./utils/logger"
import cookieParser from "cookie-parser"
import cors from "cors"

// importing routers

import authRouter from "@/features/auth/auth.routes"
import githubRouter from "@/features/github/github.routes"
import repositoriesRouter from "@/features/repositories/repositories.routes"
import deploymentRouter from "@/features/deployment/deployment.routes"
import projectsRouter from "@/features/projects/projects.routes"
import environmentRouter from "@/features/environment/environment.routes"
import resourcesRouter from "@/features/resources/resources.routes"
import logsRouter from "@/features/logs/logs.routes"
import webhooksRouter from "@/features/webhooks/github.routes"

const app: Express = express()

app.use(cookieParser())
app.use(
  cors({
    origin: apiConfig.allowedOrigins,
    credentials: true,
  })
)

/*
 * GitHub webhooks are mounted before the global JSON parser: the HMAC
 * signature covers the exact request bytes, so this route keeps the raw
 * buffer while parsing. Push payloads are larger than the 100kb default, and
 * only this endpoint gets the raised limit.
 */
app.use(
  "/api/v1/webhooks",
  express.json({
    limit: "5mb",
    verify: (req, _res, buffer) => {
      ;(req as { rawBody?: Buffer }).rawBody = Buffer.from(buffer)
    },
  }),
  webhooksRouter
)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

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
app.use("/api/v1/deployments", deploymentRouter)
// Log routes are mounted under /deployments so endpoints read
// /api/v1/deployments/:deploymentId/logs[/stream]
app.use("/api/v1/deployments", logsRouter)
app.use("/api/v1/projects", projectsRouter)
// Environment variables are their own feature (encrypt + apply lifecycle),
// mounted under a project so the id arrives via mergeParams.
app.use("/api/v1/projects/:projectId/environment-variables", environmentRouter)
// Live resource usage for a project — the API reads it from the deployer,
// which is the only service that talks to Kubernetes.
app.use("/api/v1/projects/:projectId/resources", resourcesRouter)
// Webhooks are mounted above, before the JSON body parser.

export default app
