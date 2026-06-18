-- AlterTable
ALTER TABLE "task_channels" ADD COLUMN     "concreteMix" DECIMAL,
ADD COLUMN     "hasEmulsifier" BOOLEAN DEFAULT false,
ADD COLUMN     "humidity" DECIMAL,
ADD COLUMN     "notes" VARCHAR(500),
ADD COLUMN     "sampleAge" INTEGER,
ADD COLUMN     "temperature" DECIMAL;
