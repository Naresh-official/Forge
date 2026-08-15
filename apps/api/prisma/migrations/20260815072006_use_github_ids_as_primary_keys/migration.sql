/*
  Warnings:

  - The primary key for the `githubInstallations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `githubId` on the `githubInstallations` table. All the data in the column will be lost.
  - The primary key for the `githubRepositories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `githubId` on the `githubRepositories` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[installationId,id]` on the table `githubRepositories` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_installationId_fkey";

-- DropIndex
DROP INDEX "githubInstallations_githubId_key";

-- DropIndex
DROP INDEX "githubRepositories_installationId_githubId_key";

-- AlterTable
ALTER TABLE "githubInstallations" DROP CONSTRAINT "githubInstallations_pkey",
DROP COLUMN "githubId",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "githubInstallations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_pkey",
DROP COLUMN "githubId",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "installationId" SET DATA TYPE TEXT,
ADD CONSTRAINT "githubRepositories_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_installationId_id_key" ON "githubRepositories"("installationId", "id");

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "githubInstallations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
