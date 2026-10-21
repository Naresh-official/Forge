import type { AuthUser } from "@forge/types"

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
      /**
       * Exact request bytes, kept for GitHub webhook HMAC verification.
       * Only populated for routes parsed with the raw-body JSON parser.
       */
      rawBody?: Buffer
    }
  }
}

export {}
