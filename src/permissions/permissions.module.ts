import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionGuard } from '../auth/guards/permission.guard';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
})
export class PermissionsModule {}
