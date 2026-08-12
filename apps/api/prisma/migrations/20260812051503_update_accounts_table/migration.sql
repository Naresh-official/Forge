/*
  Warnings:

  - You are about to drop the column `accessTokenExpiresAt` on the `accounts` table. All the data in the column will be lost.
  - You are about to drop the column `refreshToken` on the `accounts` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,provider]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `provider` on the `accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `accessToken` on table `accounts` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "accounts_provider_providerAccountId_key";

-- AlterTable
ALTER TABLE "accounts" DROP COLUMN "accessTokenExpiresAt",
DROP COLUMN "refreshToken",
DROP COLUMN "provider",
ADD COLUMN     "provider" "RepositoryProvider" NOT NULL,
ALTER COLUMN "accessToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_userId_provider_key" ON "accounts"("userId", "provider");
