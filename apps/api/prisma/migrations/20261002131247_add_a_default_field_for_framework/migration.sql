-- CreateEnum
CREATE TYPE "Framework" AS ENUM ('NEXTJS', 'VITE', 'REACT', 'VUE', 'NUXT', 'SVELTE', 'SVELTEKIT', 'ASTRO', 'ANGULAR', 'REMIX', 'NESTJS', 'EXPRESS', 'UNKNOWN');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "framework" "Framework" NOT NULL DEFAULT 'UNKNOWN';
