/*
  Warnings:

  - The primary key for the `githubInstallations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `githubRepositories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - Changed the type of `id` on the `githubInstallations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `id` on the `githubRepositories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `installationId` on the `githubRepositories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_installationId_fkey";

-- AlterTable
ALTER TABLE "githubInstallations" DROP CONSTRAINT "githubInstallations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
ADD CONSTRAINT "githubInstallations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
DROP COLUMN "installationId",
ADD COLUMN     "installationId" INTEGER NOT NULL,
ADD CONSTRAINT "githubRepositories_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "githubRepositories_installationId_idx" ON "githubRepositories"("installationId");

-- CreateIndex
CREATE UNIQUE INDEX "githubRepositories_installationId_id_key" ON "githubRepositories"("installationId", "id");

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "githubInstallations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
