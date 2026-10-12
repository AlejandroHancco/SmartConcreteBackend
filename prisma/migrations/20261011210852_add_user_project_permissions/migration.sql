-- CreateTable
CREATE TABLE "user_project_permissions" (
    "userId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "permissionId" VARCHAR(100) NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_project_permissions_pkey" PRIMARY KEY ("userId","projectId","permissionId")
);

-- AddForeignKey
ALTER TABLE "user_project_permissions" ADD CONSTRAINT "user_project_permissions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project_permissions" ADD CONSTRAINT "user_project_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_project_permissions" ADD CONSTRAINT "user_project_permissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("uuid") ON DELETE CASCADE ON UPDATE NO ACTION;
