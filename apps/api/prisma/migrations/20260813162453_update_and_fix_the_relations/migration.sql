/*
  Warnings:

  - A unique constraint covering the columns `[userId,slug]` on the table `projects` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `provider` on the `accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `userId` to the `githubInstallations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `projects` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('GITHUB', 'GOOGLE');

-- DropIndex
DROP INDEX "projects_slug_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "provider",
ADD COLUMN     "provider" "OAuthProvider" NOT NULL;

-- AlterTable
ALTER TABLE "githubInstallations" ADD COLUMN     "userId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "userId" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_provider_key" ON "accounts"("userId", "provider");

-- CreateIndex
CREATE INDEX "githubInstallations_userId_idx" ON "githubInstallations"("userId");

-- CreateIndex
CREATE INDEX "projects_userId_idx" ON "projects"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_userId_slug_key" ON "projects"("userId", "slug");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "githubInstallations" ADD CONSTRAINT "githubInstallations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
