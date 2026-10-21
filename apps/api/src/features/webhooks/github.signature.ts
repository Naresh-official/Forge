import { createHmac, timingSafeEqual } from "node:crypto"

const SIGNATURE_PREFIX = "sha256="

/**
 * Verifies the `X-Hub-Signature-256` header GitHub attaches to every webhook
 * delivery.
 *
 * The signature is an HMAC-SHA256 of the *exact* request bytes, so the raw
 * body must be used — re-serialising `req.body` would change key order and
 * whitespace and never match. Comparison is constant-time so a wrong
 * signature cannot be brute-forced byte by byte.
 */
export function verifyGithubSignature(
  rawBody: Buffer | undefined,
  signature: string | undefined,
  secret: string
): boolean {
  if (!rawBody || !signature || !secret) {
    return false
  }

  if (!signature.startsWith(SIGNATURE_PREFIX)) {
    return false
  }

  const expected = Buffer.from(
    createHmac("sha256", secret).update(rawBody).digest("hex"),
    "utf8"
  )
  const received = Buffer.from(signature.slice(SIGNATURE_PREFIX.length), "utf8")

  // timingSafeEqual throws on length mismatch, which would leak the expected
  // length; compare lengths first.
  if (expected.length !== received.length) {
    return false
  }

  return timingSafeEqual(expected, received)
}
