import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { deployRepository } from "./deployment.controller"

const router: Router = Router()

// All routes here require authentication
router.use(authenticate)

router.post("/new/:repoId", deployRepository)

export default router
