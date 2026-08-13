import { Router } from "express"
import { githubAuthHandler, meHandler } from "./auth.controller"
import { authenticate } from "@/middleware/auth.middleware"

const router: Router = Router()

router.post("/github", githubAuthHandler)
router.get("/me", authenticate, meHandler)

export default router
