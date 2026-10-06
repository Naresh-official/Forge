import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { getDeploymentLogs, streamDeploymentLogs } from "./logs.controller"

const router: Router = Router()

router.use(authenticate)

// Historical (S3, paginated): /api/v1/deployments/:deploymentId/logs
router.get("/:deploymentId/logs", getDeploymentLogs)
// Live (SSE over Redis): /api/v1/deployments/:deploymentId/logs/stream
router.get("/:deploymentId/logs/stream", streamDeploymentLogs)

export default router
