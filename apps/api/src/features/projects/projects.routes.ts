import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { listAllProjects, listProjectNames } from "./projects.controller"

const router: Router = Router()

router.use(authenticate)

router.get("/all", listAllProjects)
router.get("/list", listProjectNames)

export default router
