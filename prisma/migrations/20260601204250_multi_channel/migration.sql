/*
  Warnings:

  - You are about to drop the column `points` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `startFreq` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `stopFreq` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `sweepType` on the `task_preferences` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "measurements" ADD COLUMN     "rangeId" INTEGER;

-- AlterTable
ALTER TABLE "task_preferences" DROP COLUMN "points",
DROP COLUMN "startFreq",
DROP COLUMN "stopFreq",
DROP COLUMN "sweepType";

-- CreateTable
CREATE TABLE "task_preference_ranges" (
    "id" SERIAL NOT NULL,
    "taskPreferenceId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 801,
    "sweepType" VARCHAR(20) NOT NULL DEFAULT 'LIN',

    CONSTRAINT "task_preference_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_preference_ranges_taskPreferenceId_order_key" ON "task_preference_ranges"("taskPreferenceId", "order");

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_rangeId_fkey" FOREIGN KEY ("rangeId") REFERENCES "task_preference_ranges"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preference_ranges" ADD CONSTRAINT "task_preference_ranges_taskPreferenceId_fkey" FOREIGN KEY ("taskPreferenceId") REFERENCES "task_preferences"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
