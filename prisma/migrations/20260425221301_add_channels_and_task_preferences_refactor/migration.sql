/*
  Warnings:

  - You are about to drop the column `taskPreferenceId` on the `measurements` table. All the data in the column will be lost.
  - You are about to drop the column `analyzerIp` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `analyzerName` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `createdBy` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `muxIp` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `muxName` on the `task_preferences` table. All the data in the column will be lost.
  - You are about to drop the column `points` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `startFreq` on the `tasks` table. All the data in the column will be lost.
  - You are about to drop the column `stopFreq` on the `tasks` table. All the data in the column will be lost.
  - Added the required column `points` to the `measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sweepType` to the `measurements` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `task_preferences` table without a default value. This is not possible if the table is not empty.
  - Made the column `analyzerDeviceId` on table `task_preferences` required. This step will fail if there are existing NULL values in that column.
  - Made the column `muxDeviceId` on table `task_preferences` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "measurements" DROP CONSTRAINT "measurements_taskPreferenceId_fkey";

-- DropForeignKey
ALTER TABLE "task_preferences" DROP CONSTRAINT "task_preferences_analyzerDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "task_preferences" DROP CONSTRAINT "task_preferences_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "task_preferences" DROP CONSTRAINT "task_preferences_muxDeviceId_fkey";

-- AlterTable
ALTER TABLE "measurements" DROP COLUMN "taskPreferenceId",
ADD COLUMN     "points" INTEGER NOT NULL,
ADD COLUMN     "presetName" VARCHAR(100),
ADD COLUMN     "sweepType" VARCHAR(20) NOT NULL,
ADD COLUMN     "takenByEmail" VARCHAR(255),
ADD COLUMN     "takenByName" VARCHAR(200);

-- AlterTable
ALTER TABLE "task_preferences" DROP COLUMN "analyzerIp",
DROP COLUMN "analyzerName",
DROP COLUMN "createdBy",
DROP COLUMN "muxIp",
DROP COLUMN "muxName",
ADD COLUMN     "name" VARCHAR(100) NOT NULL,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 801,
ADD COLUMN     "sweepType" VARCHAR(20) NOT NULL DEFAULT 'LOG',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6),
ALTER COLUMN "analyzerDeviceId" SET NOT NULL,
ALTER COLUMN "muxDeviceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "tasks" DROP COLUMN "points",
DROP COLUMN "startFreq",
DROP COLUMN "stopFreq";

-- CreateTable
CREATE TABLE "task_channels" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "channelNumber" INTEGER NOT NULL,
    "alias" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6),

    CONSTRAINT "task_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_channels" (
    "id" SERIAL NOT NULL,
    "measurementId" INTEGER NOT NULL,
    "channelNumber" INTEGER NOT NULL,
    "channelAlias" VARCHAR(100),
    "concreteMix" DECIMAL,
    "hasEmulsifier" BOOLEAN DEFAULT false,
    "notes" VARCHAR(500),
    "sampleAge" INTEGER,
    "temperature" DECIMAL,
    "humidity" DECIMAL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "measurement_channels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_channels_taskId_channelNumber_key" ON "task_channels"("taskId", "channelNumber");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_channels_measurementId_channelNumber_key" ON "measurement_channels"("measurementId", "channelNumber");

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_analyzerDeviceId_fkey" FOREIGN KEY ("analyzerDeviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_muxDeviceId_fkey" FOREIGN KEY ("muxDeviceId") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_channels" ADD CONSTRAINT "task_channels_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "measurement_channels" ADD CONSTRAINT "measurement_channels_measurementId_fkey" FOREIGN KEY ("measurementId") REFERENCES "measurements"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
