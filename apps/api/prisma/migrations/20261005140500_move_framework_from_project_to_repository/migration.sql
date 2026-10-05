-- AlterTable
ALTER TABLE "githubRepositories" ADD COLUMN     "framework" "Framework";

-- AlterTable
ALTER TABLE "projects" DROP COLUMN "framework";
