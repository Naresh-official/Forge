import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import {
  createEnvironmentVariable,
  deleteEnvironmentVariable,
  listEnvironmentVariables,
  updateEnvironmentVariable,
} from "./environment.controller"

/*
 * Mounted under `/api/v1/projects/:projectId/environment-variables`, so the
 * project id comes from the parent router (`mergeParams`). Feature-scoped
 * router rather than a projects sub-resource: environment variables own their
 * own encrypt/apply lifecycle.
 */
const router: Router = Router({ mergeParams: true })

router.use(authenticate)

router.get("/", listEnvironmentVariables)
router.post("/", createEnvironmentVariable)
router.patch("/:key", updateEnvironmentVariable)
router.delete("/:key", deleteEnvironmentVariable)

export default router
