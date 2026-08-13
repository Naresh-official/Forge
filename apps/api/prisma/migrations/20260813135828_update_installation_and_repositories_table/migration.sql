-- AlterTable
ALTER TABLE "githubRepositories" ALTER COLUMN "projectId" DROP NOT NULL,
ALTER COLUMN "defaultBranch" SET DEFAULT 'main';
