/*
  Warnings:

  - Added the required column `projectId` to the `devices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "projectId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;
