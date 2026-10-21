import type { Request, Response } from "express"
import { apiConfig } from "@forge/config/api"
import logger from "@/utils/logger"
import { verifyGithubSignature } from "./github.signature"
import { githubPushEventSchema, handleGithubPushEvent } from "./github.service"

/**
 * POST /api/v1/webhooks/github
 *
 * Entry point for GitHub App deliveries. Unauthenticated by design — GitHub
 * cannot present a session cookie — so the HMAC signature over the raw body is
 * the only proof the request came from GitHub.
 *
 * Responses:
 * - 200 `ping` events (sent when the webhook is first configured)
 * - 202 accepted: the push was queued, or deliberately ignored (branch not
 *   deployed, repository not linked, commit already deployed, unsupported
 *   event). GitHub treats 2xx as delivered.
 * - 401 invalid/missing signature, 500 when the delivery could not be
 *   processed so GitHub can retry it.
 */
export const githubWebhook = async (req: Request, res: Response) => {
  const secret = apiConfig.github.webhookSecret

  if (!secret) {
    logger.error(
      "GITHUB_WEBHOOK_SECRET is not configured — refusing the GitHub delivery"
    )
    return res.status(500).json({
      status: "error",
      reason: "webhook secret is not configured",
    })
  }

  const signature = req.header("x-hub-signature-256")

  if (!verifyGithubSignature(req.rawBody, signature, secret)) {
    logger.warn(
      { delivery: req.header("x-github-delivery") },
      "Rejected GitHub webhook delivery with an invalid signature"
    )
    return res
      .status(401)
      .json({ status: "error", reason: "invalid signature" })
  }

  const event = req.header("x-github-event")

  if (!event) {
    return res
      .status(400)
      .json({ status: "error", reason: "missing X-GitHub-Event header" })
  }

  // Sent once when the App's webhook is configured.
  if (event === "ping") {
    return res.status(200).json({ status: "ok", message: "pong" })
  }

  if (event !== "push") {
    return res
      .status(202)
      .json({ status: "ignored", reason: `unsupported event: ${event}` })
  }

  const parsed = githubPushEventSchema.safeParse(req.body)

  if (!parsed.success) {
    logger.warn(
      {
        issues: parsed.error.flatten(),
        delivery: req.header("x-github-delivery"),
      },
      "Ignored a GitHub push payload that did not match the expected shape"
    )
    return res
      .status(202)
      .json({ status: "ignored", reason: "unsupported push payload" })
  }

  try {
    const result = await handleGithubPushEvent(parsed.data)

    if (result.status === "ignored") {
      logger.info(
        { reason: result.reason, delivery: req.header("x-github-delivery") },
        "GitHub push webhook ignored"
      )
    }

    return res.status(202).json(result)
  } catch (error) {
    logger.error(
      { err: error, delivery: req.header("x-github-delivery") },
      "Failed to handle a GitHub push webhook"
    )
    return res
      .status(500)
      .json({ status: "error", reason: "deployment could not be queued" })
  }
}
