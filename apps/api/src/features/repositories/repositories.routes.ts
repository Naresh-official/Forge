import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { listRepositories } from "./repositories.controller"

const router: Router = Router()

// All routes here require authentication
router.use(authenticate)

router.get("/", listRepositories)

export default router
