/*
  Warnings:

  - You are about to drop the `deploymentEvents` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "deploymentEvents" DROP CONSTRAINT "deploymentEvents_deploymentId_fkey";

-- DropTable
DROP TABLE "deploymentEvents";
