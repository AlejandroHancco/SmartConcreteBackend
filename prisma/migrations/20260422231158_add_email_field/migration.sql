-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" VARCHAR(100) NOT NULL,
    "description" TEXT,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" VARCHAR(100) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "User" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "lastName" VARCHAR(100),
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "Project" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("uuid")
);

-- CreateTable
CREATE TABLE "UserProjectRole" (
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "roleId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProjectRole_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(150) NOT NULL,
    "type" VARCHAR(50),
    "ip" VARCHAR(45),
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" VARCHAR(500),
    "status" VARCHAR(50) DEFAULT 'pending',
    "points" DECIMAL,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "projectId" UUID NOT NULL,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPreference" (
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
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" UUID,

    CONSTRAINT "TaskPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "takenBy" UUID NOT NULL,
    "takenAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startFreq" DECIMAL NOT NULL,
    "stopFreq" DECIMAL NOT NULL,
    "analyzerName" VARCHAR(150) NOT NULL,
    "analyzerIp" VARCHAR(45) NOT NULL,
    "muxName" VARCHAR(150) NOT NULL,
    "muxIp" VARCHAR(45) NOT NULL,
    "taskPreferenceId" INTEGER,
    "data" JSONB NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectRole" ADD CONSTRAINT "UserProjectRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectRole" ADD CONSTRAINT "UserProjectRole_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProjectRole" ADD CONSTRAINT "UserProjectRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("uuid") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPreference" ADD CONSTRAINT "TaskPreference_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPreference" ADD CONSTRAINT "TaskPreference_analyzerDeviceId_fkey" FOREIGN KEY ("analyzerDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPreference" ADD CONSTRAINT "TaskPreference_muxDeviceId_fkey" FOREIGN KEY ("muxDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPreference" ADD CONSTRAINT "TaskPreference_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("uuid") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_takenBy_fkey" FOREIGN KEY ("takenBy") REFERENCES "User"("uuid") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_taskPreferenceId_fkey" FOREIGN KEY ("taskPreferenceId") REFERENCES "TaskPreference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
