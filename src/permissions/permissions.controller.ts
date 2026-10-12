import { Controller, Get, Patch, Param, Body, UseGuards, ParseIntPipe } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller()
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Get('permissions')
  @RequirePermission('permission:edit')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Get('roles')
  @RequirePermission('role:edit')
  findAllRoles() {
    return this.permissionsService.findAllRoles();
  }

  @Patch('roles/:roleId/permissions')
  @RequirePermission('permission:edit')
  updateRolePermissions(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body() body: { permissions: string[] },
  ) {
    return this.permissionsService.updateRolePermissions(roleId, body.permissions);
  }
}
