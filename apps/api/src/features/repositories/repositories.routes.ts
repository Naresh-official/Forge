import { Router } from "express"
import { authenticate } from "@/middleware/auth.middleware"
import { deployRepository, listRepositories } from "./repositories.controller"

const router: Router = Router()

// All routes here require authentication
router.use(authenticate)

router.get("/", listRepositories)
router.post("/deploy", deployRepository)

export default router
