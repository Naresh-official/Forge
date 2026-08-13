import { Router } from "express"
import { githubSetup, redirectToInstallationPage } from "./github.controller"

const router: Router = Router()

router.get("/install", redirectToInstallationPage)

router.get("/setup", githubSetup)

export default router
