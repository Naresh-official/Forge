import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { getProjectResources } from "./resources.controller"

/*
 * Mounted under `/api/v1/projects/:projectId/resources`, so the project id
 * arrives from the parent router via `mergeParams`.
 */
const router: Router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", getProjectResources)

export default router
