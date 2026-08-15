-- DropForeignKey
ALTER TABLE "githubRepositories" DROP CONSTRAINT "githubRepositories_projectId_fkey";

-- AddForeignKey
ALTER TABLE "githubRepositories" ADD CONSTRAINT "githubRepositories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
