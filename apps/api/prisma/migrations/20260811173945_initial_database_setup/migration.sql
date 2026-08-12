-- CreateEnum
CREATE TYPE "RepositoryProvider" AS ENUM ('GITHUB', 'GITLAB', 'BITBUCKET');

-- CreateEnum
CREATE TYPE "DeploymentStatus" AS ENUM ('QUEUED', 'BUILDING', 'DEPLOYING', 'READY', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeploymentEnvironment" AS ENUM ('PRODUCTION', 'PREVIEW');

-- CreateEnum
CREATE TYPE "DomainType" AS ENUM ('CUSTOM', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "BuildStatus" AS ENUM ('QUEUED', 'BUILDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GitHubAccountType" AS ENUM ('USER', 'ORGANIZATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apiKeys" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apiKeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "repositoryUrl" TEXT NOT NULL,
    "repositoryProvider" "RepositoryProvider" NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployments" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "deploymentNumber" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT,
    "branch" TEXT NOT NULL,
    "status" "DeploymentStatus" NOT NULL,
    "environment" "DeploymentEnvironment" NOT NULL,
    "imageUrl" TEXT,
    "imageTag" TEXT,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploymentResources" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "cpuMillicores" INTEGER NOT NULL,
    "memoryMb" INTEGER NOT NULL,
    "ephemeralStorageMb" INTEGER NOT NULL,

    CONSTRAINT "deploymentResources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "autoscalingPolicies" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "minReplicas" INTEGER NOT NULL DEFAULT 1,
    "maxReplicas" INTEGER NOT NULL DEFAULT 1,
    "targetCpuPercent" INTEGER,
    "targetMemoryPercent" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autoscalingPolicies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "domains" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "deploymentId" UUID,
    "hostname" TEXT NOT NULL,
    "type" "DomainType" NOT NULL,
    "status" "DomainStatus" NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "environmentVariables" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "environmentVariables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploymentEnvironmentVariables" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "deploymentEnvironmentVariables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "builds" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "status" "BuildStatus" NOT NULL,
    "builderId" TEXT,
    "buildImage" TEXT,
    "artifactPath" TEXT,
    "logsPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deploymentEvents" (
    "id" UUID NOT NULL,
    "deploymentId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deploymentEvents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "githubInstallations" (
    "id" UUID NOT NULL,
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" "GitHubAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "githubInstallations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "githubRepositories" (
    "id" UUID NOT NULL,
    "installationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "githubRepositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "apiKeys_keyHash_key" ON "apiKeys"("keyHash");

-- CreateIndex
CREATE INDEX "apiKeys_userId_idx" ON "apiKeys"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE INDEX "deployments_projectId_idx" ON "deployments"("projectId");

-- CreateIndex
CREATE INDEX "deployments_createdBy_idx" ON "deployments"("createdBy");

-- CreateIndex
CREATE INDEX "deployments_status_idx" ON "deployments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "deployments_projectId_deploymentNumber_key" ON "deployments"("projectId", "deploymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "deploymentResources_deploymentId_key" ON "deploymentResources"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "autoscalingPolicies_deploymentId_key" ON "autoscalingPolicies"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "domains_hostname_key" ON "domains"("hostname");

-- CreateIndex
CREATE INDEX "domains_projectId_idx" ON "domains"("projectId");

-- CreateIndex
CREATE INDEX "domains_deploymentId_idx" ON "domains"("deploymentId");

-- CreateIndex
CREATE INDEX "environmentVariables_projectId_idx" ON "environmentVariables"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "environmentVariables_projectId_key_key" ON "environmentVariables"("projectId", "key");

-- CreateIndex
CREATE INDEX "deploymentEnvironmentVariables_deploymentId_idx" ON "deploymentEnvironmentVariables"("deploymentId");

-- CreateIndex
CREATE UNIQUE INDEX "deploymentEnvironmentVariables_deploymentId_key_key" ON "deploymentEnvironmentVariables"("deploymentId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "builds_deploymentId_key" ON "builds"("deploymentId");

-- CreateIndex
CREATE INDEX "deploymentEvents_deploymentId_idx" ON "deploymentEvents"("deploymentId");

-- CreateIndex
CREATE INDEX "deploymentEvents_deploymentId_createdAt_idx" ON "deploymentEvents"("deploymentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "githubInstallations_installationId_key" ON "githubInstallations"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_projectId_key" ON "githubRepositories"("projectId");

-- CreateIndex
CREATE INDEX "githubRepositories_installationId_idx" ON "githubRepositories"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_installationId_repositoryId_key" ON "githubRepositories"("installationId", "repositoryId");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "apiKeys" ADD CONSTRAINT "apiKeys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploymentResources" ADD CONSTRAINT "deploymentResources_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoscalingPolicies" ADD CONSTRAINT "autoscalingPolicies_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "domains" ADD CONSTRAINT "domains_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "environmentVariables" ADD CONSTRAINT "environmentVariables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploymentEnvironmentVariables" ADD CONSTRAINT "deploymentEnvironmentVariables_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "builds" ADD CONSTRAINT "builds_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deploymentEvents" ADD CONSTRAINT "deploymentEvents_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "githubInstallations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
