<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Forge — Agent Reference

> Last updated: 2026-08-26

Forge is a **self-hosted deployment platform** (think Vercel / Railway) built as a Turborepo monorepo. It accepts GitHub repositories, builds them, and deploys the results as either static artifacts (uploaded to MinIO/S3) or containerised images (pushed to a private Docker registry).

---

## Monorepo Layout

```
Forge/
├── apps/
│   ├── api/       — Express + Bun REST API (+ gRPC server)
│   ├── builder/   — Bun build-worker service (+ gRPC server)
│   ├── deployer/  — Bun deployment-worker service (+ gRPC server)
│   └── web/       — Next.js 16 frontend (App Router)
└── packages/
    ├── api-client/         — Typed HTTP client consumed by the web app
    ├── config/             — Centralised env-var config (Zod-validated)
    ├── contracts/          — Protobuf definitions shared between api, builder & deployer
    ├── eslint-config/      — Shared ESLint config
    ├── registry/           — Docker registry push helpers
    ├── storage/            — S3-compatible storage helpers (MinIO SDK)
    ├── types/              — Shared TypeScript types / API response types
    ├── typescript-config/  — Shared tsconfig bases
    └── ui/                 — shadcn/ui component library (React + Tailwind)
```

Package manager: **Bun 1.3.14**
Task runner: **Turborepo 2.x** (`bun run dev | build | lint | typecheck`)

---

## Apps

### `apps/web` — Next.js Frontend

| Detail        | Value                                            |
| ------------- | ------------------------------------------------ |
| Framework     | **Next.js 16.2.6** (App Router, React 19)        |
| Auth          | **next-auth v5 beta** — GitHub OAuth only        |
| Styling       | Tailwind CSS v4 + shadcn/ui (`@forge/ui`)        |
| Internal deps | `@forge/ui`, `@forge/api-client`, `@forge/types` |

**Route groups:**

```
app/
├── (public)/
│   ├── login/        — Sign-in page
│   └── docs/         — Documentation
└── (dashboard)/      — Authenticated area
    ├── dashboard/    — Home / overview
    ├── projects/     — Project list & [projectId] detail pages
    ├── deployments/  — Deployment list & detail
    ├── domains/      — Domain management
    ├── environments/ — Environment variable management
    └── settings/     — Account settings
```

**Auth flow:** `auth.ts` configures NextAuth with the GitHub provider. On sign-in the JWT callback calls `@forge/api-client/auth` to sync the user with the backend and stores the backend `userId` in the session token.

> ⚠️ Always read `node_modules/next/dist/docs/` before using any Next.js API. The `next` version in this repo (16.x) introduces breaking changes relative to Next.js 13-15.

---

### `apps/api` — REST + gRPC API

| Detail             | Value                                 |
| ------------------ | ------------------------------------- |
| Runtime            | **Bun**                               |
| Framework          | **Express 5**                         |
| ORM                | **Prisma 7** (PostgreSQL, adapter-pg) |
| Auth               | next-auth v5 (session validation)     |
| Logging            | pino + pino-pretty                    |
| GitHub integration | Octokit                               |

**REST routes (prefix `/api/v1`):**

| Path            | Router                                              |
| --------------- | --------------------------------------------------- |
| `/health`       | inline health check                                 |
| `/auth`         | `features/auth` — session/token endpoints           |
| `/github`       | `features/github` — webhook & installation events   |
| `/repositories` | `features/repositories` — list repos via GitHub App |
| `/deployments`  | `features/deployment` — create & manage deployments |

**gRPC services:**

- `BuilderService.Build` (`builder.proto`) — triggers a build on the builder
- `ApiService.BuildStarted` (`builder.proto`) — builder calls this when a job begins; returns repo metadata + GitHub access token
- `ApiService.BuildCompleted` (`builder.proto`) — builder calls this with the build result (image URL / static artifact key, status, etc.); on success, api forwards details to `DeployerService.Deploy`
- `DeployerService.Deploy` (`deployer.proto`) — api calls this on deployer to queue a deployment
- `DeployerApiService.DeploymentStarted` (`deployer.proto`) — deployer worker calls this when deployment starts; sets deployment status to `DEPLOYING`

**Database schema highlights (Prisma):**

| Model                 | Notes                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `User`                | UUID PK, GitHub OAuth via `Account`                                  |
| `Project`             | Belongs to User; unique `(userId, slug)`                             |
| `Deployment`          | Status: `QUEUED → BUILDING → DEPLOYING → READY / FAILED / CANCELLED` |
| `Build`               | 1-to-1 with Deployment; separate `BuildStatus` lifecycle             |
| `Domain`              | `CUSTOM` or `SYSTEM`; `PENDING → ACTIVE / FAILED`                    |
| `EnvironmentVariable` | Encrypted at rest (`valueEncrypted`)                                 |
| `GitHubInstallation`  | GitHub App installation per User                                     |
| `GitHubRepository`    | Linked to Installation; optionally connected to a Project            |
| `DeploymentResource`  | CPU/memory/storage specs per Deployment                              |

---

### `apps/builder` — Build Worker Service

| Detail  | Value                                                       |
| ------- | ----------------------------------------------------------- |
| Runtime | **Bun**                                                     |
| Queue   | **BullMQ** (Redis)                                          |
| gRPC    | Exposes `BuilderService`; calls `ApiService` on the api app |

**Architecture:**

1. The main process (`src/index.ts`) starts a gRPC server and spawns N worker OS-processes (`src/worker/worker.ts`), one per CPU in production.
2. Each worker picks jobs from the BullMQ queue.
3. On each job the worker:
   - Calls `ApiService.BuildStarted` → receives repo metadata + access token
   - Clones the GitHub repo
   - **Detects** the project type (`src/worker/features/detect.ts`)
   - **Builds** using the matching strategy
   - Calls `ApiService.BuildCompleted` with the result
   - Cleans up the cloned directory and any generated Dockerfiles

**Build strategies:**

| Strategy                  | Detected by                                 | Output                 | Stored as                                        |
| ------------------------- | ------------------------------------------- | ---------------------- | ------------------------------------------------ |
| `node` (static framework) | `package.json` + static framework detection | Built output directory | MinIO object under `deployments/<id>/`           |
| `node` (server framework) | `package.json` + server framework detection | Docker image           | Private registry `<registry>/<repo>:<commitSha>` |
| `dockerfile`              | Presence of a `Dockerfile`                  | Docker image           | Private registry                                 |
| `docker-compose`          | Presence of `docker-compose.yml`            | Multiple images        | Private registry                                 |

---

### `apps/deployer` — Deployment Worker Service

| Detail  | Value                                                                |
| ------- | -------------------------------------------------------------------- |
| Runtime | **Bun**                                                              |
| Queue   | **BullMQ** (Redis)                                                   |
| gRPC    | Exposes `DeployerService`; calls `DeployerApiService` on the api app |

**Architecture:**

1. The main process (`src/index.ts`) starts a gRPC server and spawns worker OS-processes (`src/worker/worker.ts`).
2. The gRPC server receives `Deploy` requests from the API and enqueues jobs onto the BullMQ queue (`forge-deployer`).
3. Each worker picks jobs from the BullMQ queue.
4. On each job the worker:
   - Calls `DeployerApiService.DeploymentStarted` → updates deployment status to `DEPLOYING` in the API database
   - Executes deployment tasks (target infrastructure orchestration)

---

## Shared Packages

### `@forge/config`

Centralised, Zod-validated config loaded from environment variables. Exports separate typed config objects: `webConfig`, `apiConfig`, `builderConfig`, `deployerConfig`.
Source files: `api.ts`, `builder.ts`, `web.ts`, `deployer.ts`, `shared.ts`.

### `@forge/contracts`

Protobuf definitions (`proto/builder.proto`, `proto/deployer.proto`, `proto/health.proto`) and their generated TypeScript bindings (`src/`). Used by `apps/api`, `apps/builder`, and `apps/deployer`.

### `@forge/api-client`

Typed HTTP client for the `api` app, consumed by the `web` app.

### `@forge/storage`

MinIO/S3 helper: `uploadDirectory()` — recursively uploads a local directory to an S3-compatible bucket.

### `@forge/registry`

Docker registry helpers: `pushImage()` and `pushComposeImages()` for pushing built Docker images to the private registry.

### `@forge/ui`

shadcn/ui component library. Add components via:

```bash
bunx shadcn@latest add <component> -c apps/web
```

Components land in `packages/ui/src/components/`. Import via `@forge/ui/components/<name>`.

### `@forge/types`

Shared TypeScript types including `ApiError` and API response shapes used across `api` and `web`.

---

## Key Conventions & Rules

### Coding

- **TypeScript strict mode** everywhere — do not disable `strict`.
- All packages use **ESM** (`"type": "module"`).
- Use **`@/`** path alias for intra-package imports (e.g. `@/features/auth`).
- Express routes follow `feature.routes.ts → feature.controller.ts → feature.service.ts`.
- Prisma client is generated to `apps/api/src/generated/prisma` — do not commit generated files.
- The `contracts` package must be rebuilt (`ts-proto`) whenever `.proto` files change.

### Environment & Config

- All env vars go through `@forge/config` — **never** read `process.env` directly in application code.
- Each service has its own typed config object (`webConfig`, `apiConfig`, `builderConfig`, `deployerConfig`).
- Changes to env vars require updating both `.env.example` and the relevant Zod schema in `packages/config/src/`.

### Database

- Migrations live in `apps/api/prisma/migrations/`. Always run `prisma migrate dev` for schema changes during development.
- `EnvironmentVariable.valueEncrypted` values are **always** encrypted — never store plaintext secrets.
- `GitLab` and `Bitbucket` are marked `// TODO:` in the schema — do not implement without explicit instruction.

### gRPC

- `api`, `builder`, and `deployer` each run their own gRPC server on separate ports (configured via `@forge/config`).
- The `api` acts as a **client** to `builder` (`BuilderService`) and `deployer` (`DeployerService`), and as a **server** to both (`ApiService`, `DeployerApiService`).
- Do not add new gRPC services without updating `packages/contracts/proto/` and regenerating bindings.

### Frontend (Next.js)

- App Router only — no `pages/` directory.
- Auth is JWT strategy via NextAuth v5. The `userId` (backend UUID) is embedded in the JWT — not the NextAuth default user id.
- Server Components are the default; use `"use client"` only when necessary.
- All UI components should come from `@forge/ui` to maintain design consistency.

---

## Turborepo Tasks

| Command             | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `bun run dev`       | Start all apps in watch mode                            |
| `bun run build`     | Build all apps and packages (respects dependency order) |
| `bun run lint`      | Lint all workspaces                                     |
| `bun run typecheck` | Type-check all workspaces                               |
| `bun run format`    | Format with Prettier                                    |

---

## Infrastructure Dependencies (runtime)

| Service                 | Used by                      | Purpose                       |
| ----------------------- | ---------------------------- | ----------------------------- |
| PostgreSQL              | `api`                        | Primary database              |
| Redis                   | `builder`, `deployer`        | BullMQ job queue              |
| MinIO (S3-compatible)   | `builder`, `@forge/storage`  | Static build artifact storage |
| Docker daemon           | `builder`                    | Building and tagging images   |
| Private Docker registry | `builder`, `@forge/registry` | Image storage                 |
| GitHub App              | `api`, `web`                 | OAuth + repository access     |
