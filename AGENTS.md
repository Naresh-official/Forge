<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Forge — Agent Reference

> Last updated: 2026-10-04

Forge is a **self-hosted deployment platform / PaaS** (think Vercel / Railway) built as a Turborepo monorepo. It connects GitHub repositories to an automated build and Kubernetes deployment pipeline: a **control-plane API**, asynchronous **Builder** and **Deployer** workers, PostgreSQL for durable state, Redis/BullMQ for async work, object storage for static artifacts, and a container registry for images.

The pipeline is:

```
GitHub Repository → Project → Build → Artifact / Image → Deployment → Running Application
```

Architecturally the layers split as:

| Layer            | Component       | Responsibility                                  |
| ---------------- | --------------- | ----------------------------------------------- |
| Control plane    | `apps/api`      | Owns durable state, auth, orchestration         |
| Build plane      | `apps/builder`  | Clone source, produce deployable output         |
| Deployment plane | `apps/deployer` | Turn artifacts/images into Kubernetes resources |
| Runtime plane    | Kubernetes      | Runs the deployed workload                      |
| Interface        | `apps/web`      | Next.js dashboard                               |

The API is the **central coordinator**. It initiates builds and deployments and records lifecycle state, but never performs expensive build or Kubernetes work itself.

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
    ├── config/             — Centralised env-var config (Zod-validated) + config.yaml
    ├── contracts/          — Protobuf definitions shared between api, builder & deployer
    ├── eslint-config/      — Shared ESLint config
    ├── frameworks/         — Framework detection / static-vs-server classification
    ├── logger/             — File + terminal pino logger factory
    ├── registry/           — Container registry helpers (AWS ECR)
    ├── storage/            — S3-compatible object storage helpers (AWS S3 / MinIO)
    ├── types/              — Shared TypeScript types / API response types
    ├── typescript-config/  — Shared tsconfig bases
    └── ui/                 — shadcn/ui component library (React + Tailwind)
```

Package manager: **Bun 1.3.14**
Task runner: **Turborepo 2.x** (`bun run dev | build | lint | typecheck`)

Config is loaded from the **repo-root** `.env` (git-ignored; `.env.example` is committed).

### Service ports

| Service    | REST/HTTP | gRPC |
| ---------- | --------- | ---- |
| `web`      | 3000      | —    |
| `api`      | 8000      | 8001 |
| `builder`  | —         | 8002 |
| `deployer` | —         | 8003 |

Static per-service settings (ports, queue options, worker counts, buckets, ECR repos) live in `packages/config/src/config.yaml`, **not** in env vars.

---

## Apps

### `apps/web` — Next.js Frontend

| Detail        | Value                                            |
| ------------- | ------------------------------------------------ |
| Framework     | **Next.js 16.2.6** (App Router, React 19)        |
| Auth          | **next-auth v5 beta** — GitHub OAuth only        |
| Server state  | **TanStack Query v5**                            |
| Styling       | Tailwind CSS v4 + shadcn/ui (`@forge/ui`)        |
| Internal deps | `@forge/ui`, `@forge/api-client`, `@forge/types` |

**Route groups:**

```
app/
├── (public)/
│   ├── login/        — Sign-in page
│   └── docs/         — Documentation
├── (dashboard)/      — Authenticated area (wrapped in AppShell)
│   ├── dashboard/    — Home / overview
│   ├── projects/     — Project list, new/, and [projectId]/ detail
│   │   ├── new/          — Create-project wizard
│   │   └── [projectId]/  — Overview, deployments/, deployments/[deploymentId]/,
│   │                       logs/, domains/, environment-variables/, resources/, settings/
│   ├── deployments/  — Deployment list & detail
│   ├── domains/      — Domain management
│   ├── environments/ — Environment variable management
│   └── settings/     — Account settings (profile/, preferences/, notifications/)
├── api/auth/[...nextauth]/route.ts
└── page.tsx          — redirects to /dashboard
```

**Auth flow:** `auth.ts` configures NextAuth with the GitHub provider. On sign-in the JWT callback calls `@forge/api-client/auth` to sync the user with the backend and stores the backend `userId` in the session token.

**Server → client user plumbing:** `app/(dashboard)/layout.tsx` is a server component that calls `await auth()` and passes a `SessionUser` (`{ name, email, image }`) into `AppShell` → `Sidebar`/`Topbar`. Client components read the user from that prop — there is **no `SessionProvider`** and `useSession()` will not work.

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
| GitHub integration | Octokit (`@octokit/app`)              |

**REST routes (prefix `/api/v1`, mounted in `src/app.ts`):**

| Path               | Method | Auth | Handler                                                    |
| ------------------ | ------ | ---- | ---------------------------------------------------------- |
| `/health`          | GET    | no   | inline health check                                        |
| `/auth/github`     | POST   | no   | `features/auth` — sync GitHub user into the DB             |
| `/auth/me`         | GET    | yes  | `features/auth` — current user                             |
| `/github/install`  | GET    | yes  | `features/github` — 302 redirect to the GitHub App install |
| `/github/setup`    | GET    | yes  | `features/github` — GitHub App post-install callback       |
| `/repositories`    | GET    | yes  | `features/repositories` — repos via the GitHub App         |
| `/deployments/new` | POST   | yes  | `features/deployment` — create project + first deployment  |
| `/projects/all`    | GET    | yes  | `features/projects` — full project list                    |
| `/projects/list`   | GET    | yes  | `features/projects` — `{ id, name }` only                  |

Every router except `POST /auth/github` is guarded by the `authenticate` middleware.

**Routing structure:** `feature.routes.ts → feature.controller.ts → feature.service.ts`. Controllers are thin: parse/validate input, call the service, wrap the result in `ApiResponse`, and funnel failures through `handleErrors(res, error)`.

**Middlewares / utilities:**

- `src/middleware/auth.middleware.ts` — reads the `authjs.session-token` cookie (`__Secure-authjs.session-token` in production), decodes it with `next-auth/jwt` using `apiConfig.authSecret` and the cookie name as salt, and sets `req.user = { id, email }`.
- `src/types/express.d.ts` — augments Express `Request` with `user?: AuthUser`.
- `src/utils/handleErrors.ts` — maps `ApiError` → its status, `ZodError` → 400 with flattened messages, anything else → 500.
- `src/utils/logger.ts` — pino instance. Debug body logging only when `NODE_ENV === "development"`.

**gRPC services:**

- `BuilderService.Build` (`builder.proto`) — triggers a build on the builder
- `ApiService.BuildStarted` (`builder.proto`) — builder calls this when a job begins; returns repo metadata + GitHub access token
- `ApiService.BuildCompleted` (`builder.proto`) — builder calls this with the build result (image URL / static artifact key, status, etc.); on success, api forwards details to `DeployerService.Deploy`
- `DeployerService.Deploy` (`deployer.proto`) — api calls this on deployer to queue a deployment
- `DeployerApiService.DeploymentStarted` (`deployer.proto`) — deployer worker calls this when deployment starts; sets deployment status to `DEPLOYING`
- `DeployerApiService.DeploymentCompleted` (`deployer.proto`) — deployer worker reports the final status; sets `READY`/`FAILED` and stores the image URL

**Failure handling worth preserving:** if `startBuildWrapper` throws, `deployment.service.ts` marks both the build and deployment `FAILED` and returns a 502 rather than leaving them stuck in `QUEUED`. Likewise the API marks the deployment `FAILED` if forwarding to the deployer fails.

**Database schema highlights (Prisma):**

| Model                 | Notes                                                                |
| --------------------- | -------------------------------------------------------------------- |
| `User`                | UUID PK, GitHub OAuth via `Account`                                  |
| `Project`             | Belongs to User; unique `(userId, slug)`                             |
| `Deployment`          | Status: `QUEUED → BUILDING → DEPLOYING → READY / FAILED / CANCELLED` |
| `Build`               | 1-to-1 with Deployment; separate `BuildStatus` lifecycle             |
| `Domain`              | `CUSTOM` or `SYSTEM`; `PENDING → ACTIVE / FAILED`                    |
| `EnvironmentVariable` | Encrypted at rest (`valueEncrypted`)                                 |
| `GitHubInstallation`  | GitHub App installation per User; PK is the GitHub `installation.id` |
| `GitHubRepository`    | Linked to Installation; `projectId` optional + unique; holds the detected `framework` (null = not detected yet) |
| `DeploymentResource`  | CPU/memory/storage specs per Deployment                              |

`BuildStatus` is `QUEUED → BUILDING → SUCCEEDED / FAILED / CANCELLED` — it is **not** the same lifecycle as `DeploymentStatus`. A build can stay `SUCCEEDED` even if the subsequent rollout fails.

`GitHubRepository.projectId` uses `onDelete: SetNull`, so deleting a project unlinks the repository instead of deleting it.

---

### `apps/builder` — Build Worker Service

| Detail  | Value                                                       |
| ------- | ----------------------------------------------------------- |
| Runtime | **Bun**                                                     |
| Queue   | **BullMQ** (Redis)                                          |
| gRPC    | Exposes `BuilderService`; calls `ApiService` on the api app |

**Source layout:**

```
src/
├── index.ts                 — starts gRPC server, spawns workers
├── queue/queue.ts           — builderQueue (name from builderConfig)
├── gRPC/
│   ├── server.ts
│   ├── clients/api.client.ts
│   ├── services/{builder,health}.service.ts
│   └── wrapper/api.wrapper.ts
└── worker/
    ├── worker.ts            — BullMQ Worker
    ├── process/run-command.ts
    └── features/
        ├── detect.ts        — build strategy + package-manager detection
        ├── git.ts           — clone
        ├── logs/build-logs.ts
        └── builders/
            ├── node.builder.ts
            ├── node.container.ts
            ├── dockerfile.builder.ts
            └── docker-compose.builder.ts
```

**Architecture:**

1. The main process (`src/index.ts`) starts a gRPC server and spawns N worker OS-processes (`src/worker/worker.ts`): **1** when `nodeEnv === "development"`, otherwise `builderConfig.workerCount` (currently `2`, from `config.yaml`) — not one per CPU.
2. Each worker picks jobs from the BullMQ queue (`forge-builder`).
3. On each job the worker:
   - Calls `ApiService.BuildStarted` → receives repo metadata + access token
   - Clones the GitHub repo into `builderConfig.tempDir` (`/tmp/forge-builder`)
   - **Detects** the project type (`src/worker/features/detect.ts`)
   - **Builds** using the matching strategy
   - Calls `ApiService.BuildCompleted` with the result
   - Cleans up the cloned directory and any generated Dockerfiles

**Build strategies:**

| Strategy                  | Detected by                                 | Output                 | Stored as                                                 |
| ------------------------- | ------------------------------------------- | ---------------------- | --------------------------------------------------------- |
| `node` (static framework) | `package.json` + static framework detection | Built output directory | S3 under `<projectId>/<deploymentId>/<repo-name>/`        |
| `node` (server framework) | `package.json` + server framework detection | Docker image           | ECR `forge-project:<projectId>.<deploymentId>.<repoName>` |
| `dockerfile`              | Presence of a `Dockerfile`                  | Docker image           | ECR `forge-project` (same tag scheme)                     |
| `docker-compose`          | Presence of `docker-compose.yml`            | Multiple images        | ECR `forge-project` (`<tag>.<service>` tags)              |

The strategy name is forwarded to the deployer, which uses it to decide whether Kubernetes work is needed at all.

---

### `apps/deployer` — Deployment Worker Service

| Detail         | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Runtime        | **Bun**                                                              |
| Queue          | **BullMQ** (Redis, queue `forge-deployer`)                           |
| gRPC           | Exposes `DeployerService`; calls `DeployerApiService` on the api app |
| Runtime target | Kubernetes (`@kubernetes/client-node`)                               |

**Architecture:**

1. The main process (`src/index.ts`) starts a gRPC server and spawns worker OS-processes (`src/worker/worker.ts`) on the same rule as the builder: 1 in development, otherwise `deployerConfig.workerCount` (currently `2`).
2. The gRPC server receives `Deploy` requests from the API and enqueues jobs onto the BullMQ queue (`forge-deployer`).
3. Each worker picks jobs from the BullMQ queue.
4. On each job the worker:
   - Calls `DeployerApiService.DeploymentStarted` → sets deployment status to `DEPLOYING`
   - **Branches on strategy**: static/non-container builds have no Kubernetes resources, so the worker immediately reports `READY` (the artifact already lives in object storage). Only container strategies (`dockerfile`, `docker-compose`, or `node` **with** an `imageUrl`) proceed to Kubernetes.
   - Fetches a short-lived ECR authorization token and creates a `docker-registry` pull secret in the deployment namespace
   - Creates/updates the namespace, Deployment, Service and registry secret
   - Polls the rollout; reports `READY` only if the rollout actually became available, otherwise `FAILED`
   - On any error, best-effort reports `FAILED` to the API and rethrows so BullMQ records the failure

**Kubernetes layer** (`src/kubernetes/`) deliberately separates concerns:

```
kubernetes/
├── index.ts                 — public surface
├── kubernetes.client.ts     — KubernetesClient (ensure ns, deploy container, poll rollout)
├── naming.ts                — K8s-safe naming
├── constants.ts
├── types.ts
├── http/kube-http.client.ts — thin HTTP wrapper
├── manifests/               — pure manifest builders (namespace, deployment, service, registry-secret)
└── resources/               — per-resource APIs (namespace, deployment, service, secret)
```

**Naming conventions** (from `kubernetes/naming.ts`):

- Namespace: `forge-project-<projectId>-<deploymentId>`
- Deployment + Service name: `app-<deploymentId>`
- All names are lowercased, sanitized to DNS-safe characters and truncated to **63 chars** — with two full UUIDs the tail of the `deploymentId` is cut off. Never assume you can recover a full UUID from a namespace name.
- Container port is `80`; pull secret is named `forge-ecr-pull`.

---

## Shared Packages

### `@forge/api-client`

Typed HTTP client for the `api` app, consumed by the `web` app. This is the **transport boundary** — components should not construct `fetch` calls directly.

Modules (`src/`): `client.ts`, `auth.ts`, `project.ts`, `repositories.ts`, `deployment.ts`, `github.ts`.

Exports map: `.`, `./auth`, `./project`, `./repositories`, `./deployment`, `./github`.

Key details in `client.ts`:

- Base URL from `process.env.NEXT_PUBLIC_API_URL` (+ `NEXT_PUBLIC_API_BASE_ROUTE`, default `/api/v1`).
- Sends `credentials: "include"` so the NextAuth session cookie reaches the API.
- Exposes `api<T>(path, options)` for JSON calls **and** `apiUrl(path)` for absolute URLs the browser navigates to (e.g. the GitHub install redirect).
- Deliberately does **not** import `@forge/config` — that pulls in `node:fs` and breaks client-side bundling.

### `@forge/config`

Centralised, Zod-validated config. Exports separate typed config objects: `webConfig`, `apiConfig`, `builderConfig`, `deployerConfig`.

Source files: `api.ts`, `builder.ts`, `web.ts`, `deployer.ts`, `shared.ts`, `index.ts`, plus `config.yaml` for static per-service settings.

Exports map: `.`, `./web`, `./api`, `./builder`, `./deployer`.

`shared.ts` provides `loadEnv()` (reads the root `.env`) and `loadYamlConfig()`. Each service schema merges env vars over the YAML block. Note `nodeEnv` defaults to `"production"`, which silences debug logging and verbose errors — set `NODE_ENV=development` when debugging locally.

### `@forge/contracts`

Protobuf definitions (`proto/builder.proto`, `proto/deployer.proto`, `proto/health.proto`) and their generated TypeScript bindings. Used by `apps/api`, `apps/builder`, and `apps/deployer`.

Generated code lives in `packages/contracts/src/generated/` and **is committed to git**. Regenerate with the package's script:

```bash
cd packages/contracts && bun run proto:generate
```

This shells out to `protoc` directly, so it must be installed and on `PATH`. Only `@forge/contracts` is the shared gRPC surface — `@forge/types` is for application/domain types (see "Contracts vs Types" below).

### `@forge/storage`

Object storage abstraction backed by the AWS S3 SDK (works with MinIO too). Exports `createStorageClient` and `uploadDirectory()` (recursively uploads a local directory to a bucket, with MIME type detection).

### `@forge/registry`

Container registry abstraction backed by the AWS ECR SDK. Exports `pushImage()`, `pushComposeImages()`, `getEcrAuthorizationToken()`, and `buildImageTag()`.

The deployer uses `getEcrAuthorizationToken()` to mint the pull secret; the builder uses the push helpers.

### `@forge/ui`

shadcn/ui component library (Base UI + CVA + tailwind-merge). Currently ships only `button`.

Exports map: `./globals.css`, `./postcss.config`, `./components/*`, `./lib/*`, `./hooks/*`.

Add components via:

```bash
bunx shadcn@latest add <component> -c apps/web
```

Components land in `packages/ui/src/components/`. Import via `@forge/ui/components/<name>`.

### `@forge/types`

Shared TypeScript types including `ApiError`, `ApiResponse`, and API response shapes used across `api` and `web`.

Modules (`src/`): `apiResponses.ts`, `auth.ts`, `user.ts`, `github.ts`, `project.ts`, `deployment.ts`, `index.ts`.

Exports map: `.`, `./auth`, `./apiResponses`, `./user`, `./github`, `./deployment`, `./project`.

> ⚠️ The root `index.ts` re-exports `auth`, `user`, `apiResponses`, `deployment` and `project` — but **not** `github`. Import GitHub types from the `@forge/types/github` subpath.

### `@forge/typescript-config`

Shared tsconfig presets: `base.json`, `nextjs.json`, `react-library.json`.

### `@forge/eslint-config`

Shared linting config, layered as base (JS/TS + Turbo) → Next.js/React/React Hooks. Wrapped in `eslint-plugin-only-warn`, so most rule violations surface as **warnings** — a clean `eslint` exit code does not by itself mean the code is warning-free. Read the output.

---

## Key Conventions & Rules

### Coding

- **TypeScript strict mode** everywhere — do not disable `strict`.
- All packages use **ESM** (`"type": "module"`).
- Use **`@/`** path alias for intra-package imports (e.g. `@/features/auth`).
- Express routes follow `feature.routes.ts → feature.controller.ts → feature.service.ts`.
- Workspace packages use **subpath exports**. Adding a module to `@forge/api-client`, `@forge/types` or `@forge/config` requires registering it in that package's `package.json` `exports` map, or the import will fail to resolve.
- Never import `@forge/config` from client-side (`"use client"`) code — it depends on `node:fs`.
- Prisma client is generated to `apps/api/src/generated/prisma` — do not commit generated output.
- The `contracts` package must be rebuilt (`proto:generate`) whenever `.proto` files change, and its generated output **is** committed.

### API conventions

- Wrap successful responses in `new ApiResponse<T>(statusCode, data, message)`; throw `ApiError(statusCode, message)` for failures and let `handleErrors` shape the response.
- Validate request bodies with Zod schemas from `@forge/types` (e.g. `createRepositorySchema`); `handleErrors` turns `ZodError` into a 400 with readable field messages.
- Always wrap controller bodies in `try/catch` and call `handleErrors(res, error)`.
- Read the caller from `req.user` (populated by `authenticate`); it is `AuthUser = { id, email }`.

### Database

- Migrations live in `apps/api/prisma/migrations/`. Always run `prisma migrate dev` for schema changes during development.
- `EnvironmentVariable.valueEncrypted` values are **always** encrypted — never store plaintext secrets.
- `GitLab` and `Bitbucket` are marked `// TODO:` in the schema — do not implement without explicit instruction.
- `BuildStatus` and `DeploymentStatus` are separate state machines — do not conflate them.

### gRPC

- `api`, `builder`, and `deployer` each run their own gRPC server on separate ports (configured via `@forge/config`).
- The `api` acts as a **client** to `builder` (`BuilderService`) and `deployer` (`DeployerService`), and as a **server** to both (`ApiService`, `DeployerApiService`).
- Do not add new gRPC services without updating `packages/contracts/proto/` and regenerating bindings.

### Frontend (Next.js)

- App Router only — no `pages/` directory.
- Auth is JWT strategy via NextAuth v5. The `userId` (backend UUID) is embedded in the JWT — not the NextAuth default user id.
- Server Components are the default; use `"use client"` only when necessary. `await auth()` only works in server components.
- **Server state goes through TanStack Query** (`useQuery` / `useMutation` / `useQueryClient`) via `@forge/api-client`, never ad-hoc `useEffect` + `fetch`. Providers are `QueryProvider` (root layout) and `ToastProvider` (dashboard `AppShell`).
- All UI components should come from `@forge/ui` to maintain design consistency.
- Insights that read from the API are client-side queries; server-rendered HTML will not contain them.

### GitHub integration

- Forge uses a **GitHub App** (not just the user's OAuth token) for repository access. Installation-scoped tokens are minted per operation via `githubApp.getInstallationOctokit(installationId)`; the builder receives one from `ApiService.BuildStarted`.
- `syncInstallationRepositories()` in `features/github/github.service.ts` is the single place that mirrors GitHub repositories into the database: it upserts new/renamed repos and prunes repos the installation can no longer access — **except** those already attached to a project.
- `GET /repositories` refreshes from GitHub on every read, so treat it as a write-on-read path (it mutates `githubRepositories`) and do not cache it aggressively.

### Testing

> ⚠️ **There is no test suite in this repo.** No test runner (vitest/jest) is installed and no workspace defines a `test` script, so `bun run test` does not exist.

`apps/api/src/builder.test.ts` is **not** a test — it is a manual scratch script that calls `startBuildWrapper` with a hardcoded build ID. Do not treat it as a regression suite.

Verify changes with `bun run typecheck` and `bun run lint`, and by exercising the real interface.

---

## Turborepo Tasks

| Command             | Description                                             |
| ------------------- | ------------------------------------------------------- |
| `bun run dev`       | Start all apps in watch mode                            |
| `bun run build`     | Build all apps and packages (respects dependency order) |
| `bun run lint`      | Lint all workspaces                                     |
| `bun run typecheck` | Type-check all workspaces                               |
| `bun run format`    | Format with Prettier                                    |

Packages also expose `proto:generate` (`packages/contracts`) and `studio` (`apps/api`, Prisma Studio).

---

## Infrastructure Dependencies (runtime)

| Service                                 | Used by                                  | Purpose                                              |
| --------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| PostgreSQL                              | `api`                                    | Primary database / source of truth                   |
| Redis                                   | `builder`, `deployer`                    | BullMQ job queue (`forge-builder`, `forge-deployer`) |
| S3 / MinIO                              | `builder`, `@forge/storage`              | Static build artifact storage                        |
| Docker daemon                           | `builder`                                | Building and tagging images                          |
| AWS ECR                                 | `builder`, `deployer`, `@forge/registry` | Container image storage (push + pull credentials)    |
| Kubernetes (kind locally, EKS in cloud) | `deployer`                               | Runtime for deployed applications                    |
| GitHub App                              | `api`, `web`, `builder`                  | OAuth + repository access                            |

Local development has been done against Bun, Docker, PostgreSQL, Redis, MinIO and kind; the Kubernetes layer has also been exercised against EKS.

---

## Architectural Decisions (why it looks like this)

1. **The API is the control plane** — it owns durable state and orchestrates, but never builds or talks to Kubernetes directly.
2. **Builder and Deployer are separate services** — building and deploying have different resource profiles and failure modes, so they scale and evolve independently.
3. **Queues absorb long-running work** — builds/deploys are CPU-heavy, slow, and failure-prone, so they run asynchronously off BullMQ rather than inside an HTTP request.
4. **gRPC for internal traffic, HTTP for users** — HTTP is the user-facing boundary; gRPC carries service-to-service calls.
5. **PostgreSQL is the source of truth** — transient execution state belongs in Redis/workers, durable lifecycle state belongs in Postgres.
6. **Storage and registry are abstracted** — S3/MinIO and ECR are reached through `@forge/storage` and `@forge/registry` rather than being coupled into application code.
7. **Contracts and types are separate** — `@forge/contracts` holds gRPC protocol definitions; `@forge/types` holds application/domain types. This keeps protobuf shapes from becoming the frontend's domain model.
8. **Frontend server state is separated from UI state** — TanStack Query over `@forge/api-client` keeps transport concerns out of components.
