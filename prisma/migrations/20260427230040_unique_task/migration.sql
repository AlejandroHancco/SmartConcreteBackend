/*
  Warnings:

  - You are about to drop the column `projectId` on the `devices` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[taskId]` on the table `task_preferences` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "devices" DROP CONSTRAINT "devices_projectId_fkey";

-- AlterTable
ALTER TABLE "devices" DROP COLUMN "projectId";

-- AlterTable
ALTER TABLE "task_preferences" ALTER COLUMN "sweepType" SET DEFAULT 'LIN';

-- CreateIndex
CREATE UNIQUE INDEX "task_preferences_taskId_key" ON "task_preferences"("taskId");
