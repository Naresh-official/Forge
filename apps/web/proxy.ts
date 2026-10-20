import { NextResponse } from "next/server"
import { auth } from "@/auth"

/*
 * Next.js 16 renamed Middleware to Proxy (`proxy.ts`), so this file is the
 * request gate for the dashboard area. The `(dashboard)` route group has no
 * URL segment of its own, so each top-level section is matched explicitly.
 *
 * `auth()` validates the NextAuth session cookie — a forged or expired token
 * is rejected here, not merely a missing one. The API still authenticates
 * every request on its own; this only keeps anonymous visitors out of the UI.
 */
export const proxy = auth((request) => {
  if (request.auth) {
    return NextResponse.next()
  }

  const { pathname, search } = request.nextUrl
  const loginUrl = new URL("/login", request.nextUrl.origin)
  const target = `${pathname}${search}`

  // Send the user back to where they were headed after they sign in.
  if (target !== "/dashboard") {
    loginUrl.searchParams.set("callbackUrl", target)
  }

  return NextResponse.redirect(loginUrl)
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/projects/:path*",
    "/deployments/:path*",
    "/domains/:path*",
    "/environments/:path*",
    "/settings/:path*",
  ],
}
