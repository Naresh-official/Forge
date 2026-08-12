import { Router } from "express"
import { githubAuthHandler } from "./auth.controller"

const router: Router = Router()

router.post("/github", githubAuthHandler)

export default router
