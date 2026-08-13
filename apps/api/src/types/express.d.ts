import type { AuthUser } from "@workspace/types"

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser
        }
    }
}

export {}
