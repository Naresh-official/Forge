import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@forge/ui"],
  images: {
    // Avatars come from the GitHub OAuth profile — the only auth provider.
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
}

export default nextConfig
