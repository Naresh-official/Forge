/*
  Warnings:

  - You are about to drop the column `githubAccountLogin` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `githubAccountType` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `githubInstallationId` on the `githubInstallations` table. All the data in the column will be lost.
  - You are about to drop the column `githubInstallationIdPk` on the `githubRepositories` table. All the data in the column will be lost.
  - You are about to drop the column `githubRepositoryId` on the `githubRepositories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[githubId]` on the table `githubInstallations` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[installationId,githubId]` on the table `githubRepositories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `accountLogin` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `accountType` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubId` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `githubId` to the `githubRepositories` table without a default value. This is not possible if the table is not empty.
  - Added the required column `installationId` to the `githubRepositories` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_githubInstallationIdPk_fkey";

-- DropIndex
DROP INDEX "githubInstallations_githubInstallationId_key";

-- DropIndex
DROP INDEX "githubRepositories_githubInstallationIdPk_githubRepositoryI_key";

-- DropIndex
DROP INDEX "githubRepositories_githubInstallationIdPk_idx";

-- AlterTable
ALTER TABLE "githubInstallations" DROP COLUMN "githubAccountLogin",
DROP COLUMN "githubAccountType",
DROP COLUMN "githubInstallationId",
ADD COLUMN     "accountLogin" TEXT NOT NULL,
ADD COLUMN     "accountType" "GitHubAccountType" NOT NULL,
ADD COLUMN     "githubId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "githubRepositories" DROP COLUMN "githubInstallationIdPk",
DROP COLUMN "githubRepositoryId",
ADD COLUMN     "githubId" TEXT NOT NULL,
ADD COLUMN     "installationId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "githubInstallations_githubId_key" ON "githubInstallations"("githubId");

-- CreateIndex
CREATE INDEX "githubRepositories_installationId_idx" ON "githubRepositories"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_installationId_githubId_key" ON "githubRepositories"("installationId", "githubId");

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "githubInstallations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
