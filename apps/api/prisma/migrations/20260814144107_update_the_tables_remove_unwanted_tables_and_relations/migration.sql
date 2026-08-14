/*
  Warnings:

  - You are about to drop the column `artifactPath` on the `builds` table. All the data in the column will be lost.
  - You are about to drop the column `buildImage` on the `builds` table. All the data in the column will be lost.
  - You are about to drop the column `builderId` on the `builds` table. All the data in the column will be lost.
  - You are about to drop the column `environment` on the `deployments` table. All the data in the column will be lost.
  - You are about to drop the column `defaultBranch` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `repositoryProvider` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the column `repositoryUrl` on the `projects` table. All the data in the column will be lost.
  - You are about to drop the `apiKeys` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `autoscalingPolicies` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `deploymentEnvironmentVariables` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `autoscalingEnabled` to the `deploymentResources` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "apiKeys" DROP CONSTRAINT "apiKeys_userId_fkey";

-- DropForeignKey
ALTER TABLE "autoscalingPolicies" DROP CONSTRAINT "autoscalingPolicies_deploymentId_fkey";

-- DropForeignKey
ALTER TABLE "deploymentEnvironmentVariables" DROP CONSTRAINT "deploymentEnvironmentVariables_deploymentId_fkey";

-- AlterTable
ALTER TABLE "builds" DROP COLUMN "artifactPath",
DROP COLUMN "buildImage",
DROP COLUMN "builderId";

-- AlterTable
ALTER TABLE "deploymentResources" ADD COLUMN     "autoscalingEnabled" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "deployments" DROP COLUMN "environment",
ADD COLUMN     "artifactBucket" TEXT,
ADD COLUMN     "artifactKey" TEXT;

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "defaultBranch",
DROP COLUMN "repositoryProvider",
DROP COLUMN "repositoryUrl";

-- DropTable
DROP TABLE "apiKeys";

-- DropTable
DROP TABLE "autoscalingPolicies";

-- DropTable
DROP TABLE "deploymentEnvironmentVariables";

-- DropEnum
DROP TYPE "DeploymentEnvironment";
