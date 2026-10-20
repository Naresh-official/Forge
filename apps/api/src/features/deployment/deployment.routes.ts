import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import {
  deployRepository,
  getDeployment,
  listDeployments,
  redeployDeployment,
} from "./deployment.controller"

const router: Router = Router()

// All routes here require authentication
router.use(authenticate)

router.post("/new", deployRepository)

// Cross-project list for the deployments page.
router.get("/", listDeployments)

// Single deployment (detail page) and its redeploy action. Logs are mounted
// on the same prefix by `features/logs` (`/:deploymentId/logs`).
router.get("/:deploymentId", getDeployment)
router.post("/:deploymentId/redeploy", redeployDeployment)

export default router
