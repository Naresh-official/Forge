import { Router } from "express"
import { githubSetup, redirectToInstallationPage } from "./github.controller"
import { authenticate } from "@/middleware/auth.middleware"

const router: Router = Router()

router.get("/install", authenticate, redirectToInstallationPage)

router.get("/setup", authenticate, githubSetup)

export default router
