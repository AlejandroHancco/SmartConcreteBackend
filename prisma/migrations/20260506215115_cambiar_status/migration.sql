/*
  Warnings:

  - The values [warning,maintenance] on the enum `DeviceStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DeviceStatus_new" AS ENUM ('online', 'offline', 'unchecked');
ALTER TABLE "platform"."devices" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "devices" ALTER COLUMN "status" TYPE "DeviceStatus_new" USING ("status"::text::"DeviceStatus_new");
ALTER TYPE "DeviceStatus" RENAME TO "DeviceStatus_old";
ALTER TYPE "DeviceStatus_new" RENAME TO "DeviceStatus";
DROP TYPE "platform"."DeviceStatus_old";
ALTER TABLE "devices" ALTER COLUMN "status" SET DEFAULT 'offline';
COMMIT;
