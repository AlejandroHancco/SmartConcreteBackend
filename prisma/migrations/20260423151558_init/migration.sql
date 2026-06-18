/*
  Warnings:

  - You are about to drop the `Device` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Measurement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Permission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Project` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Role` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RolePermission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Task` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TaskPreference` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserProjectRole` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Measurement" DROP CONSTRAINT "Measurement_takenBy_fkey";

-- DropForeignKey
ALTER TABLE "Measurement" DROP CONSTRAINT "Measurement_taskId_fkey";

-- DropForeignKey
ALTER TABLE "Measurement" DROP CONSTRAINT "Measurement_taskPreferenceId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_roleId_fkey";

-- DropForeignKey
ALTER TABLE "Task" DROP CONSTRAINT "Task_projectId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPreference" DROP CONSTRAINT "TaskPreference_analyzerDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPreference" DROP CONSTRAINT "TaskPreference_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "TaskPreference" DROP CONSTRAINT "TaskPreference_muxDeviceId_fkey";

-- DropForeignKey
ALTER TABLE "TaskPreference" DROP CONSTRAINT "TaskPreference_taskId_fkey";

-- DropForeignKey
ALTER TABLE "UserProjectRole" DROP CONSTRAINT "UserProjectRole_projectId_fkey";

-- DropForeignKey
ALTER TABLE "UserProjectRole" DROP CONSTRAINT "UserProjectRole_roleId_fkey";

-- DropForeignKey
ALTER TABLE "UserProjectRole" DROP CONSTRAINT "UserProjectRole_userId_fkey";

-- DropTable
DROP TABLE "Device";

-- DropTable
DROP TABLE "Measurement";

-- DropTable
DROP TABLE "Permission";

-- DropTable
DROP TABLE "Project";

-- DropTable
DROP TABLE "Role";

-- DropTable
DROP TABLE "RolePermission";

-- DropTable
DROP TABLE "Task";

-- DropTable
DROP TABLE "TaskPreference";

-- DropTable
DROP TABLE "User";

-- DropTable
DROP TABLE "UserProjectRole";

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(50),
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurements" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "takenBy" UUID NOT NULL,
    "takenAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "analyzerName" VARCHAR(150) NOT NULL,
    "analyzerIp" VARCHAR(45) NOT NULL,
    "muxName" VARCHAR(150) NOT NULL,
    "muxIp" VARCHAR(45) NOT NULL,
    "taskPreferenceId" INTEGER,
    "data" JSONB NOT NULL,

    CONSTRAINT "measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" INTEGER NOT NULL,
    "permissionId" VARCHAR(100) NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_preferences" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "analyzerName" VARCHAR(150) NOT NULL,
    "analyzerIp" VARCHAR(45) NOT NULL,
    "analyzerDeviceId" UUID,
    "muxName" VARCHAR(150) NOT NULL,
    "muxIp" VARCHAR(45) NOT NULL,
    "muxDeviceId" UUID,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "task_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "status" VARCHAR(50) DEFAULT 'pending',
    "points" DECIMAL,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "projectId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_project_roles" (
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roleId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_project_roles_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "users" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "lastName" VARCHAR(100),
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("uuid")
);

-- CreateIndex
CREATE INDEX "idx_measurements_data_gin" ON "measurements" USING GIN ("data");

-- CreateIndex
CREATE INDEX "idx_measurements_task_taken" ON "measurements"("taskId", "takenAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "idx_task_preferences_task_created" ON "task_preferences"("taskId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_takenBy_fkey" FOREIGN KEY ("takenBy") REFERENCES "users"("uuid") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_taskPreferenceId_fkey" FOREIGN KEY ("taskPreferenceId") REFERENCES "task_preferences"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_analyzerDeviceId_fkey" FOREIGN KEY ("analyzerDeviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("uuid") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_muxDeviceId_fkey" FOREIGN KEY ("muxDeviceId") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "task_preferences" ADD CONSTRAINT "task_preferences_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project_roles" ADD CONSTRAINT "user_project_roles_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project_roles" ADD CONSTRAINT "user_project_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project_roles" ADD CONSTRAINT "user_project_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
