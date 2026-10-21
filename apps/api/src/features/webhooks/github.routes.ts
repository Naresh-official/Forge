import { Router } from "express"
import { githubWebhook } from "./github.controller"

const router: Router = Router()

/*
 * No `authenticate` middleware here: GitHub calls this endpoint directly.
 * Authenticity comes from the HMAC signature the controller verifies over the
 * raw body instead of a session cookie.
 */
router.post("/github", githubWebhook)

export default router
