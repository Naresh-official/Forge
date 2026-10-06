FROM oven/bun:1.3.14 AS base

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json bun.lock ./
COPY packages packages/
COPY apps/log-router apps/log-router/

# Install all workspace dependencies (Bun resolves workspace links)
RUN bun install --frozen-lockfile || bun install

# Copy remaining source
COPY packages packages/
COPY apps apps/

WORKDIR /app/apps/log-router

# Fluent Bit Forward protocol receiver
EXPOSE 8010

# Runtime config is via env vars (see @forge/config and .env.example)
CMD ["bun", "run", "src/index.ts"]
