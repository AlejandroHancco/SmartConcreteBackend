-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('online', 'offline', 'warning', 'maintenance');

-- AlterTable
ALTER TABLE "devices" ADD COLUMN     "status" "DeviceStatus" NOT NULL DEFAULT 'offline';
