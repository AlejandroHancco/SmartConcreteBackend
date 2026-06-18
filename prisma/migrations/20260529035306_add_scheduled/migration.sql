-- CreateEnum
CREATE TYPE "ScheduledJobStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');

-- AlterTable
ALTER TABLE "measurements" ADD COLUMN     "executionIndex" INTEGER,
ADD COLUMN     "scheduledJobId" INTEGER;

-- CreateTable
CREATE TABLE "scheduled_jobs" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "createdBy" UUID NOT NULL,
    "label" VARCHAR(150),
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "intervalMinutes" INTEGER,
    "repeatCount" INTEGER NOT NULL DEFAULT 1,
    "status" "ScheduledJobStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "channelNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

    CONSTRAINT "scheduled_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_scheduled_jobs_task_start" ON "scheduled_jobs"("taskId", "startAt" ASC);

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_scheduledJobId_fkey" FOREIGN KEY ("scheduledJobId") REFERENCES "scheduled_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION;
