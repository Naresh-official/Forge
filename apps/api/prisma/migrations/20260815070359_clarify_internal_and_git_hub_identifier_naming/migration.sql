/*
  Warnings:

  - You are about to drop the column `createdBy` on the `deployments` table. All the data in the column will be lost.
  - You are about to drop the column `accountLogin` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `accountType` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `installationId` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `installationId` on the `githubRepositories` table. All the data in the column will be lost.
  - You are about to drop the column `repositoryId` on the `githubRepositories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[provider,providerAccountId]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[githubInstallationId]` on the table `githubInstallations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[githubInstallationIdPk,githubRepositoryId]` on the table `githubRepositories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `createdByUserId` to the `deployments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubAccountLogin` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubAccountType` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubInstallationId` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubInstallationIdPk` to the `githubRepositories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubRepositoryId` to the `githubRepositories` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "deployments" DROP CONSTRAINT "deployments_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_installationId_fkey";

-- DropIndex
DROP INDEX "accounts_userId_provider_key";

-- DropIndex
DROP INDEX "deployments_createdBy_idx";

-- DropIndex
DROP INDEX "githubInstallations_installationId_key";

-- DropIndex
DROP INDEX "githubRepositories_installationId_idx";

-- DropIndex
DROP INDEX "githubRepositories_installationId_repositoryId_key";

-- AlterTable
ALTER TABLE "deployments" DROP COLUMN "createdBy",
ADD COLUMN     "createdByUserId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "githubInstallations" DROP COLUMN "accountLogin",
DROP COLUMN "accountType",
DROP COLUMN "installationId",
ADD COLUMN     "githubAccountLogin" TEXT NOT NULL,
ADD COLUMN     "githubAccountType" "GitHubAccountType" NOT NULL,
ADD COLUMN     "githubInstallationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "githubRepositories" DROP COLUMN "installationId",
DROP COLUMN "repositoryId",
ADD COLUMN     "githubInstallationIdPk" UUID NOT NULL,
ADD COLUMN     "githubRepositoryId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "deployments_createdByUserId_idx" ON "deployments"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "githubInstallations_githubInstallationId_key" ON "githubInstallations"("githubInstallationId");

-- CreateIndex
CREATE INDEX "githubRepositories_githubInstallationIdPk_idx" ON "githubRepositories"("githubInstallationIdPk");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_githubInstallationIdPk_githubRepositoryI_key" ON "githubRepositories"("githubInstallationIdPk", "githubRepositoryId");

-- AddForeignKey
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_githubInstallationIdPk_fkey" FOREIGN KEY ("githubInstallationIdPk") REFERENCES "githubInstallations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
