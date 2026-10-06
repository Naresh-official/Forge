# Forge

> A developer infrastructure platform for building, deploying, and
> running applications from source code.

Forge is a **Vercel/Railway-style Platform-as-a-Service (PaaS)**
implemented as a TypeScript/Bun monorepo. The core idea is to let a
developer connect a GitHub repository, create a project, build the
application, package/store the resulting artifact or container image,
and deploy it onto managed infrastructure.

Forge is not intended to be a simple hosting frontend. Its architecture
is split into a **control plane** and asynchronous infrastructure
workers so that application management, builds, and deployments can
evolve independently.

---

## 1. What Forge Does

Forge provides the infrastructure and control plane needed to take an
application from:

```text
GitHub Repository
       │
       ▼
    Project
       │
       ▼
    Build
       │
       ▼
Build Artifact / Container Image
       │
       ▼
 Deployment
       │
       ▼
 Running Application
```

The platform is designed around several core capabilities:

- GitHub-based project creation
- GitHub App integration for repository access
- User authentication
- Project and deployment management
- Automated source-code detection
- Automated application builds
- Build logs and build lifecycle state
- Artifact/object storage
- Container image registry integration
- Kubernetes-based deployment
- Environment variable management
- Domain management
- Deployment/resource visibility
- A web dashboard for operating projects
- Shared TypeScript contracts and types between services

The current repository shows the implementation moving toward a
production-style platform architecture with separate API, Builder,
Deployer, and Web applications.

---

# 2. High-Level Architecture

At a high level, Forge is divided into four applications:

```text
                         ┌──────────────────────┐
                         │       Forge Web      │
                         │  Next.js Dashboard   │
                         └──────────┬───────────┘
                                    │
                              HTTP / API
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Forge API       │
                         │     Control Plane    │
                         └───────┬───────┬──────┘
                                 │       │
                         gRPC    │       │    gRPC
                                 │       │
                    ┌────────────▼─┐   ┌─▼─────────────┐
                    │    Builder   │   │    Deployer   │
                    │ Build Worker │   │ Deploy Worker │
                    └──────┬───────┘   └──────┬────────┘
                           │                    │
                    ┌──────▼──────┐       ┌────▼─────────┐
                    │ GitHub /    │       │ Kubernetes   │
                    │ Build Env   │       │ Cluster      │
                    └──────┬──────┘       └──────────────┘
                           │
                    ┌──────▼─────────────┐
                    │ Artifact / Registry│
                    │ S3 / MinIO / ECR   │
                    └────────────────────┘

              ┌──────────────────────────────────────┐
              │ PostgreSQL     Redis / BullMQ         │
              │ Source of truth  Async job execution  │
              └──────────────────────────────────────┘
```

### Architectural responsibilities

Component Responsibility

---

Web User-facing dashboard and project management UI
API Control plane, authentication, persistence, orchestration
Builder Clone source and produce deployable output
Deployer Convert deployment requests into Kubernetes resources
PostgreSQL Persistent platform state
Redis/BullMQ Asynchronous job execution
GitHub Source-code provider
Storage Build artifacts and object storage
Registry Container image storage
Kubernetes Runtime environment for deployed applications

The API is the central coordinator. It owns the platform state and
communicates with infrastructure workers rather than performing
expensive build/deployment work itself.

---

# 3. Core Request Flow

## 3.1 User Authentication

The web application supports authentication through NextAuth, with
GitHub as the primary integration.

The general flow is:

```text
User
 │
 ▼
Forge Web
 │
 ▼
NextAuth / GitHub OAuth
 │
 ▼
Authenticated Session
 │
 ▼
Forge API
```

The API contains authentication middleware and authentication services,
while GitHub-specific functionality is separated into its own feature.

---

# 4. GitHub Integration

Forge uses a **GitHub App** rather than relying only on a user's OAuth
token for repository operations.

The GitHub integration allows Forge to:

1.  Connect a GitHub installation to a Forge account.
2.  Discover repositories available to the installation.
3.  Associate a Forge project with a GitHub repository.
4.  Obtain installation-scoped access when the Builder needs to clone a
    repository.
5.  Use GitHub as the source of truth for application source code.

The API contains:

```text
features/github/
├── github.client.ts
├── github.controller.ts
├── github.routes.ts
└── github.service.ts
```

Repository management is handled separately under:

```text
features/repositories/
├── repositories.controller.ts
├── repositories.routes.ts
└── repositories.service.ts
```

This separation keeps GitHub-provider functionality distinct from
Forge's project/repository domain logic.

---

# 5. Project Creation

A Forge project represents an application managed by the platform.

Conceptually:

```text
User
 │
 ▼
Project
 │
 ├── GitHub Repository
 │
 ├── Deployments
 │
 ├── Domains
 │
 ├── Environment Variables
 │
 └── Runtime Resources
```

The web dashboard contains a project creation wizard and
project-specific views.

The API contains project services and controllers responsible for
project lifecycle operations.

The database currently contains models for entities such as:

- User
- GitHubInstallation
- GitHubRepository
- Project
- Deployment
- Build
- DeploymentResource
- Domain
- EnvironmentVariable
- Account

---

# 6. Build Pipeline

The Builder is responsible for turning source code into something that
can be deployed.

The intended pipeline is:

```text
Build Request
     │
     ▼
Forge API
     │
     │ gRPC
     ▼
Builder Service
     │
     ▼
BullMQ Queue
     │
     ▼
Builder Worker
     │
     ├── Clone Git repository
     │
     ├── Detect project
     │
     ├── Detect package manager
     │
     ├── Detect framework
     │
     ├── Install dependencies
     │
     ├── Execute build
     │
     ├── Produce artifact/image
     │
     └── Store/publish result
              │
              ▼
       Storage / Registry
```

The current Builder contains dedicated modules for:

```text
worker/features/
├── builders/
│   ├── docker-compose.builder.ts
│   ├── dockerfile.builder.ts
│   ├── node.builder.ts
│   └── node.container.ts
├── detect.ts
├── git.ts
└── logs/
    └── build-logs.ts
```

This indicates that build execution is being structured around multiple
build strategies rather than hard-coding one framework.

The current implementation has specifically worked with Node/React-style
projects and includes project detection and package-runner detection.

---

# 7. Builder Architecture

The Builder is an independent application.

It has three important layers:

```text
gRPC Server
     │
     ▼
Builder Service
     │
     ▼
BullMQ Queue
     │
     ▼
Worker
     │
     ├── Git
     ├── Detection
     ├── Build Strategies
     ├── Process Execution
     └── Build Logs
```

### gRPC

The API communicates with the Builder using gRPC.

The Builder exposes services such as:

- `BuilderService`
- `HealthService`

The Builder also contains an API client/wrapper for sending lifecycle
information back toward the API.

### Queue

BullMQ is used for asynchronous build execution.

This is important because building a project is:

- CPU intensive
- potentially long running
- failure prone
- unsuitable for a synchronous HTTP request

The API therefore initiates/co-ordinates the build while the Builder
performs the actual work asynchronously.

---

# 8. Artifact and Registry Flow

Forge has two distinct concepts:

### Object storage

The storage package abstracts object storage and currently contains
support for:

- AWS S3
- MinIO

This is useful for build artifacts and other objects produced during the
build/deployment lifecycle.

### Container registry

The registry package abstracts container registry operations and
currently uses the AWS ECR SDK.

The overall direction is:

```text
Build
 │
 ├── Static/build artifact ──────► S3 / MinIO
 │
 └── Container image ─────────────► Container Registry
                                      │
                                      ▼
                                  Kubernetes
```

The exact output depends on the selected build strategy.

---

# 9. Deployment Pipeline

Once a build has produced deployable output, Forge hands deployment work
to the Deployer.

The flow is:

```text
Build Complete
     │
     ▼
Forge API
     │
     │ gRPC
     ▼
Deployer Service
     │
     ▼
BullMQ Queue
     │
     ▼
Deployer Worker
     │
     ▼
Kubernetes Client
     │
     ├── Namespace
     ├── Deployment
     ├── Service
     └── Registry Secret
     │
     ▼
Running Application
```

The Deployer is intentionally separate from the API and Builder.

This gives Forge a clean separation:

```text
API       → What should happen?
Builder   → How do we build it?
Deployer  → How do we run it?
```

---

# 10. Kubernetes Deployment

The Deployer uses `@kubernetes/client-node` to communicate with
Kubernetes.

The repository contains abstractions for:

```text
apps/deployer/src/kubernetes/
├── constants.ts
├── http/
│   └── kube-http.client.ts
├── index.ts
├── kubernetes.client.ts
├── manifests/
│   ├── deployment.manifest.ts
│   ├── namespace.manifest.ts
│   ├── registry-secret.manifest.ts
│   └── service.manifest.ts
├── naming.ts
├── resources/
│   ├── deployment.api.ts
│   ├── namespace.api.ts
│   ├── secret.api.ts
│   └── service.api.ts
└── types.ts
```

The Kubernetes layer therefore separates:

- Kubernetes connection/client handling
- Resource naming
- Manifest generation
- Resource APIs
- Shared Kubernetes types

The platform has been tested against local Kubernetes/kind environments
and is intended to work with AWS EKS for cloud deployment.

---

# 11. Deployment Resources

A Forge deployment can result in Kubernetes resources such as:

```text
Namespace
   │
   ├── Deployment
   │      │
   │      └── Pods
   │
   ├── Service
   │
   └── Registry Secret
```

The namespace provides isolation between deployed applications.

The deployment resource describes the application workload.

The service provides networking to the workload.

The registry secret allows Kubernetes to pull private images when
required.

---

# 12. Web Dashboard

The Web application is a Next.js 16 application using React 19.

It acts as the operational interface for Forge.

The dashboard currently contains areas for:

- Overview/dashboard
- Projects
- Project deployments
- Deployment details
- Domains
- Environment variables
- Logs
- Resources
- Project settings
- Global settings
- Profile
- Preferences
- Notifications
- Documentation
- Login

The current route organization is roughly:

```text
app/
├── (dashboard)/
│   ├── dashboard/
│   ├── deployments/
│   ├── domains/
│   ├── environments/
│   ├── projects/
│   │   ├── new/
│   │   └── [projectId]/
│   │       ├── deployments/
│   │       ├── domains/
│   │       ├── environment-variables/
│   │       ├── logs/
│   │       ├── resources/
│   │       └── settings/
│   └── settings/
│       ├── notifications/
│       ├── preferences/
│       └── profile/
├── (public)/
│   ├── docs/
│   └── login/
└── api/
    └── auth/
```

The UI is built using shared Forge UI components and
Tailwind/shadcn-style primitives.

---

# 13. Web Data Layer

The Web application consumes the Forge API through the dedicated:

```text
@forge/api-client
```

package.

The API client contains domain-specific modules:

```text
packages/api-client/src/
├── auth.ts
├── client.ts
├── deployment.ts
├── github.ts
├── project.ts
└── repositories.ts
```

The client package provides a centralized API abstraction instead of
having components directly construct fetch requests.

The Web application also uses **TanStack Query** for server-state
management.

This gives the frontend:

- Request caching
- Loading states
- Error states
- Query invalidation
- Refetching
- Server-state synchronization

The architectural separation is therefore:

```text
React Component
      │
      ▼
TanStack Query
      │
      ▼
@forge/api-client
      │
      ▼
Forge HTTP API
```

This keeps transport concerns separate from UI state and makes API usage
consistent throughout the dashboard.

---

# 14. API / Control Plane

The API is the central control-plane application.

Technology:

- Bun
- TypeScript
- Express 5
- Prisma
- PostgreSQL
- NextAuth integration
- GitHub App/Octokit
- gRPC clients/server

Its responsibilities include:

- Authentication
- Users
- GitHub installations
- Repositories
- Projects
- Builds
- Deployments
- Domains
- Environment variables
- Infrastructure orchestration
- Persistent platform state
- Communication with Builder
- Communication with Deployer

The API is organized around feature modules:

```text
features/
├── auth/
├── builds/
├── deployment/
├── github/
├── projects/
└── repositories/
```

Each major domain generally contains controllers, routes, and services
where applicable.

---

# 15. API → Builder → Deployer Coordination

The API acts as the coordinator for the build/deployment lifecycle.

A simplified sequence is:

```text
User
 │
 │ Create deployment
 ▼
Web
 │
 │ HTTP
 ▼
API
 │
 │ Start build
 │
 │ gRPC
 ▼
Builder
 │
 │ BullMQ
 ▼
Worker
 │
 │ Build
 ▼
Artifact / Image
 │
 │ Build result
 ▼
API
 │
 │ Start deployment
 │
 │ gRPC
 ▼
Deployer
 │
 │ BullMQ
 ▼
Worker
 │
 │ Kubernetes API
 ▼
Running application
```

The important architectural principle is that the API does not need to
perform the actual build or Kubernetes work.

It records and coordinates the lifecycle while specialized services
execute infrastructure operations.

---

# 16. Database

Forge uses PostgreSQL as the primary persistent data store.

Prisma is used as the ORM and schema management layer.

The API currently contains:

```text
apps/api/prisma/
├── schema.prisma
└── migrations/
```

The database models include concepts such as:

```text
User
 │
 ├── Account
 ├── GitHubInstallation
 │      │
 │      └── GitHubRepository
 │
 └── Project
        │
        ├── Build
        ├── Deployment
        │      ├── DeploymentResource
        │      ├── Domain
        │      └── EnvironmentVariable
        └── ...
```

PostgreSQL is the source of truth for Forge's platform state.

Transient execution state belongs in the worker/queue systems, while
durable lifecycle state belongs in PostgreSQL.

---

# 17. Redis and BullMQ

Forge uses Redis-backed queues for asynchronous work.

The current applications use BullMQ.

Queues are used by:

- Builder
- Deployer

Conceptually:

```text
API
 │
 ├──────────────► Builder Queue ───► Builder Worker
 │
 └──────────────► Deployer Queue ──► Deployer Worker
```

This gives Forge:

- Asynchronous execution
- Retry capabilities
- Worker isolation
- Better API responsiveness
- Independent scaling of infrastructure workers

---

# 18. gRPC

gRPC is used for internal service-to-service communication.

The contracts are stored in:

```text
packages/contracts/proto/
├── builder.proto
├── deployer.proto
└── health.proto
```

Generated TypeScript code lives under:

```text
packages/contracts/src/generated/
├── builder.ts
├── deployer.ts
└── health.ts
```

The main internal communication paths are:

```text
API ─────gRPC────► Builder
API ─────gRPC────► Deployer
```

This separates internal infrastructure RPC from the public HTTP API
consumed by the Web application.

---

# 19. Storage Architecture

The `@forge/storage` package abstracts object storage.

Current dependencies indicate support for:

- AWS S3
- MinIO
- MIME type detection

This abstraction allows the same application-level storage API to be
used with local infrastructure and cloud infrastructure.

A typical artifact path can conceptually be organized by:

```text
project/
  deployment/
    build/
      files...
```

The platform has also experimented with serving built React/static
applications from S3 through CloudFront.

The broader serving architecture is intended to avoid creating a
separate CDN distribution for every deployment and instead use a shared
CDN/storage setup with deployment/project prefixes.

---

# 20. Registry Architecture

The `@forge/registry` package provides a small abstraction over
container image registries.

The current implementation uses the AWS ECR SDK.

Its role is to encapsulate registry-specific operations from the rest of
Forge.

The desired abstraction is:

```text
Builder
   │
   ▼
Registry Package
   │
   ▼
ECR / Container Registry
```

The Deployer can then use the resulting image reference when creating
Kubernetes deployments.

---

# 21. Shared Types

The `@forge/types` package contains application-level TypeScript types
shared between applications.

Current modules include:

```text
packages/types/src/
├── apiResponses.ts
├── auth.ts
├── deployment.ts
├── github.ts
├── project.ts
├── user.ts
└── index.ts
```

The goal is to avoid duplicating domain models and API response shapes
across the Web and API applications.

---

# 22. Contracts vs Types

Forge intentionally separates **internal service contracts** from
**application/domain types**.

### `@forge/contracts`

Used for service-to-service contracts, particularly gRPC:

```text
.proto
   │
   ▼
Generated TypeScript
   │
   ▼
API / Builder / Deployer
```

### `@forge/types`

Used for shared application-level TypeScript types:

```text
API domain
   │
   ├── Project types
   ├── Deployment types
   ├── GitHub types
   ├── Auth types
   └── API response types
```

This prevents the gRPC protocol definitions from becoming the frontend's
domain model.

---

# 23. Configuration Package

`@forge/config` centralizes configuration handling.

Current modules include:

```text
packages/config/src/
├── api.ts
├── builder.ts
├── deployer.ts
├── index.ts
├── shared.ts
├── web.ts
└── config.yaml
```

The package allows each application to obtain its environment-specific
configuration while keeping common configuration logic in one place.

---

# 24. UI Package

`@forge/ui` contains shared React UI components and styling
infrastructure.

Current structure includes:

```text
packages/ui/
├── src/
│   ├── components/
│   │   └── button.tsx
│   ├── lib/
│   │   └── utils.ts
│   └── styles/
│       └── globals.css
```

It is based around:

- React
- Tailwind CSS
- shadcn-style components
- Base UI
- class-variance-authority
- tailwind-merge
- Lucide icons

The purpose is to prevent the Web application from becoming a collection
of completely independent UI implementations.

---

# 25. TypeScript Configuration

`@forge/typescript-config` provides shared TypeScript configurations.

Current presets include:

```text
base.json
nextjs.json
react-library.json
```

Applications and packages can extend these configurations rather than
maintaining unrelated compiler settings.

---

# 26. ESLint Configuration

`@forge/eslint-config` provides shared linting configuration.

It includes separate configuration concerns for:

- Base JavaScript/TypeScript
- Next.js
- React
- React hooks
- Turbo
- TypeScript ESLint

This keeps linting behavior consistent across the monorepo.

---

# 27. Complete Monorepo Structure

The important source structure is:

```text
forge/
│
├── apps/
│   ├── api/
│   ├── builder/
│   ├── deployer/
│   └── web/
│
├── packages/
│   ├── api-client/
│   ├── config/
│   ├── contracts/
│   ├── eslint-config/
│   ├── registry/
│   ├── storage/
│   ├── types/
│   ├── typescript-config/
│   └── ui/
│
├── package.json
├── turbo.json
├── tsconfig.json
├── bun.lock
├── README.md
└── project.todo
```

The repository is managed as a **Turborepo monorepo** with Bun.

---

# 28. Application Summary

## `apps/api`

**Role:** Forge control plane.

**Responsibilities:**

- Authentication
- User management
- GitHub integration
- Repository management
- Project management
- Build orchestration
- Deployment orchestration
- Domain/environment management
- PostgreSQL persistence
- Internal gRPC communication

**Key technologies:**

- Bun
- TypeScript
- Express
- Prisma
- PostgreSQL
- Octokit
- gRPC
- NextAuth

---

## `apps/builder`

**Role:** Build execution service.

**Responsibilities:**

- Receive build commands
- Queue builds
- Clone GitHub repositories
- Detect project/framework/package manager
- Execute builds
- Build Docker-based projects
- Produce deployable output
- Store/publish artifacts
- Emit build lifecycle information

**Key technologies:**

- Bun
- TypeScript
- BullMQ
- Redis
- simple-git
- Docker
- gRPC
- Forge storage/registry packages

---

## `apps/deployer`

**Role:** Deployment execution service.

**Responsibilities:**

- Receive deployment commands
- Queue deployments
- Manage Kubernetes resources
- Create namespaces
- Create deployments
- Create services
- Configure registry credentials
- Communicate with Kubernetes clusters

**Key technologies:**

- Bun
- TypeScript
- BullMQ
- Redis
- gRPC
- `@kubernetes/client-node`
- Kubernetes

---

## `apps/web`

**Role:** Forge user interface.

**Responsibilities:**

- Authentication UI
- Project creation
- Project management
- Deployment management
- Deployment details
- Build/deployment logs
- Domains
- Environment variables
- Resource views
- Settings
- Documentation

**Key technologies:**

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn-style UI
- NextAuth
- TanStack Query
- `@forge/api-client`
- `@forge/ui`

---

# 29. Package Summary

## `packages/api-client`

Typed HTTP client used by the Web application to communicate with the
Forge API.

Contains domain-specific clients for:

- Authentication
- Projects
- Deployments
- GitHub
- Repositories

It is the transport boundary between the frontend and backend.

---

## `packages/config`

Central configuration package for API, Builder, Deployer, Web, and
shared settings.

---

## `packages/contracts`

Defines internal gRPC contracts and generated TypeScript code.

Contains:

- Builder protocol
- Deployer protocol
- Health protocol

---

## `packages/eslint-config`

Shared ESLint configuration used across Forge packages and applications.

---

## `packages/registry`

Container registry abstraction.

Currently backed by the AWS ECR SDK.

Used by the build/deployment pipeline to work with container images.

---

## `packages/storage`

Object storage abstraction.

Currently supports:

- AWS S3
- MinIO

Used for build artifacts and object storage.

---

## `packages/types`

Shared TypeScript domain and API types.

Used to keep frontend/backend type definitions consistent.

---

## `packages/typescript-config`

Shared TypeScript compiler configurations for:

- Base packages
- Next.js applications
- React libraries

---

## `packages/ui`

Shared React component library and styling utilities.

Used by the Web application and intended to provide consistent Forge UI
primitives.

---

# 30. Infrastructure Model

The Forge architecture is designed to separate infrastructure
responsibilities.

A representative deployment topology is:

```text
                         Internet
                            │
                            ▼
                    ┌───────────────┐
                    │   Forge Web   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Forge API   │
                    │ Control Plane │
                    └───┬───────┬───┘
                        │       │
                  gRPC  │       │  gRPC
                        │       │
             ┌──────────▼─┐   ┌─▼──────────┐
             │   Builder  │   │  Deployer  │
             │    VM      │   │     VM     │
             └──────┬─────┘   └─────┬──────┘
                    │               │
                 Redis           Redis
                    │               │
                 BullMQ           BullMQ
                    │               │
                    ▼               ▼
               Build Env       Kubernetes/EKS
                    │               │
                    └───────┬───────┘
                            │
                ┌───────────┴────────────┐
                │                        │
             Storage                  Registry
             S3/MinIO                    ECR
```

The exact production topology can evolve, but the architectural
separation remains:

**Control plane → Build plane → Deployment plane → Runtime plane**

---

# 31. Local Development

Forge has been developed and tested against local infrastructure
including:

- Bun
- Docker
- PostgreSQL
- Redis
- MinIO
- kind/Kubernetes

The Kubernetes deployment layer has also been tested with AWS EKS.

The same conceptual pipeline is intended to work locally and in cloud
environments.

---

# 32. Production Direction

The project is being developed toward a production-grade PaaS
architecture.

The intended production characteristics include:

- Separate infrastructure workers
- Persistent PostgreSQL state
- Redis-backed asynchronous queues
- Container image registry
- Kubernetes runtime
- Object storage
- CDN-backed static asset serving
- GitHub App based repository access
- Internal gRPC service communication
- Typed API clients
- Shared contracts/types
- Centralized logging and lifecycle state
- Project/deployment/domain/environment abstractions

A key design principle is to avoid coupling the user-facing API to
expensive infrastructure operations.

---

# 33. Important Architectural Decisions

### 1. API is the control plane

The API owns durable platform state and orchestrates operations.

It does not need to execute builds or directly manage every
infrastructure operation.

### 2. Builder and Deployer are separate services

Building and deploying have different resource profiles and failure
modes.

Separating them allows independent scaling and development.

### 3. Queues handle long-running work

BullMQ/Redis provides asynchronous execution for builds and deployments.

### 4. gRPC handles internal service communication

HTTP is primarily the user-facing API boundary.

gRPC is used for API-to-infrastructure-worker communication.

### 5. PostgreSQL is the source of truth

The database stores durable project, build, deployment, domain,
environment, and user state.

### 6. Storage and registry are abstracted

S3/MinIO and ECR are accessed through Forge packages rather than being
tightly coupled to application code.

### 7. Shared contracts and types

The monorepo keeps common interfaces in reusable packages instead of
duplicating them across applications.

### 8. Frontend server state is separated from UI state

The Web application uses the API client as the transport layer and
TanStack Query for caching/loading/refetching server state.

---

# 34. End-to-End Example

Consider a developer deploying a React application.

### Step 1 --- Connect GitHub

The developer authenticates and connects GitHub.

```text
GitHub
   │
   ▼
GitHub App Installation
   │
   ▼
Forge API
```

Forge records the installation and available repositories.

### Step 2 --- Create a project

The developer selects:

```text
my-react-app
```

Forge creates a Project and associates it with the repository.

### Step 3 --- Start deployment

The Web application calls the API through:

```text
TanStack Query
      ↓
@forge/api-client
      ↓
Forge API
```

### Step 4 --- Build

The API sends a build request to the Builder through gRPC.

```text
API
 │
 ▼
Builder
 │
 ▼
BullMQ
 │
 ▼
Worker
```

The worker:

1.  Creates a temporary workspace.
2.  Clones the repository.
3.  Detects the project.
4.  Detects the package manager/framework.
5.  Runs the build.
6.  Produces deployable output.
7.  Stores the output or publishes an image.
8.  Reports build lifecycle information.

### Step 5 --- Deploy

After a successful build:

```text
API
 │
 ▼
Deployer
 │
 ▼
BullMQ
 │
 ▼
Worker
 │
 ▼
Kubernetes
```

The Deployer creates/updates the required Kubernetes resources.

### Step 6 --- Application runs

The deployed workload runs inside Kubernetes and is exposed through the
configured networking/domain layer.

The Web dashboard can then display:

- Deployment status
- Logs
- Domains
- Environment variables
- Resources
- Deployment history

---

# 35. Repository Design Philosophy

Forge is intentionally structured as a monorepo because the platform
contains multiple closely related services that need to share:

- Types
- Contracts
- Configuration
- UI components
- API client behavior
- Storage abstractions
- Registry abstractions
- Build tooling

The monorepo makes it possible to change a domain model or internal
contract and update all affected consumers in one codebase.

At the same time, the `apps/` boundary keeps runtime responsibilities
isolated.

```text
apps/       → Runtime services/applications
packages/   → Reusable libraries and contracts
```

This is the main organizational principle of the repository.

---

# 36. Current Project State

The repository currently contains working foundations for:

- Forge API
- GitHub integration
- Project/repository management
- PostgreSQL/Prisma persistence
- Builder service
- BullMQ build workers
- Project detection
- Node/React build strategies
- Storage abstraction
- Registry abstraction
- Deployer service
- Kubernetes client/resource abstractions
- Next.js dashboard
- API client
- TanStack Query integration
- Shared UI
- Shared types
- Shared gRPC contracts
- Shared configuration/lint/TypeScript configuration

The system has progressed beyond a simple frontend/backend application
into a distributed platform architecture.

---

# 37. One-Sentence Description

**Forge is a TypeScript/Bun-based PaaS that connects GitHub repositories
to an automated build and Kubernetes deployment pipeline, using a
control-plane API, asynchronous Builder/Deployer workers, PostgreSQL,
Redis/BullMQ, object storage, container registries, and a Next.js
management dashboard.**

---

# 38. Architecture in One Diagram

```text
                           ┌─────────────────────┐
                           │       Developer     │
                           └──────────┬──────────┘
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │    Forge Web        │
                           │ Next.js + React      │
                           │ TanStack Query       │
                           └──────────┬──────────┘
                                      │
                              @forge/api-client
                                      │
                                      ▼
                           ┌─────────────────────┐
                           │      Forge API      │
                           │    Control Plane    │
                           │ Express + Prisma    │
                           └───────┬─────┬───────┘
                                   │     │
                                  gRPC  gRPC
                                   │     │
                     ┌─────────────▼─┐ ┌─▼──────────────┐
                     │    Builder    │ │    Deployer    │
                     │   Service     │ │    Service     │
                     └───────┬───────┘ └───────┬────────┘
                             │                 │
                          BullMQ             BullMQ
                             │                 │
                             ▼                 ▼
                         Worker            Worker
                             │                 │
                   ┌─────────┴─────────┐       │
                   │                   │       │
                   ▼                   ▼       ▼
                GitHub              Storage  Kubernetes
                   │                S3/MinIO    │
                   │                   │        │
                   └──────► Build ◄────┘        │
                              │                  │
                              ▼                  │
                           Registry ─────────────┘
                              ECR

                    ┌──────────────────────────┐
                    │       PostgreSQL         │
                    │ Persistent Forge State   │
                    └──────────────────────────┘

                    ┌──────────────────────────┐
                    │          Redis           │
                    │   Async Queue Backend     │
                    └──────────────────────────┘
```

---

## Summary

Forge is structured as a distributed PaaS rather than a monolithic web
application.

The **Web** is the user interface, the **API** is the control plane, the
**Builder** turns source code into deployable output, and the
**Deployer** turns that output into running Kubernetes workloads.

Shared packages provide the boundaries that keep those services
consistent:

```text
                   FORGE
                     │
        ┌────────────┴────────────┐
        │                         │
      APPS                      PACKAGES
        │                         │
   ┌────┼────┬────┐       ┌──────┼──────────────────┐
   │    │    │    │       │      │       │           │
  API Builder Deployer Web  Types Contracts Config  UI
                                  │
                            ┌─────┴─────┐
                            │           │
                       API Client   Storage/Registry
```

This architecture gives Forge a foundation for evolving from a working
deployment platform into a more complete developer infrastructure
platform while keeping the control plane, build system, deployment
system, and frontend independently maintainable.
