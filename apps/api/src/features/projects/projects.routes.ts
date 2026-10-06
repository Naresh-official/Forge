import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import {
  deleteProject,
  listAllProjects,
  listProjectDeployments,
  listProjectNames,
  renameProject,
  setProjectStatus,
} from "./projects.controller"

const router: Router = Router()

router.use(authenticate)

router.get("/all", listAllProjects)
router.get("/list", listProjectNames)
router.get("/:projectId/deployments", listProjectDeployments)
router.patch("/:projectId", renameProject)
router.patch("/:projectId/status", setProjectStatus)
router.delete("/:projectId", deleteProject)

export default router
