-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'active', 'inactive', 'in_progress', 'completed', 'cancelled', 'archived');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "status" "ProjectStatus" NOT NULL DEFAULT 'draft';
