import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../../common/decorators/require-permission.decorator';
import { PermissionsService } from '../../permissions/permissions.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.getAllAndOverride<string>(REQUIRE_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!permission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    const projectId = this.extractProjectId(request);
    const allowed = await this.permissionsService.hasPermission(user.id, permission, projectId);

    if (!allowed) {
      throw new ForbiddenException(`Missing permission: ${permission}`);
    }
    return true;
  }

  private extractProjectId(request: any): string | undefined {
    // /projects/:uuid routes
    if (request.params?.uuid) return request.params.uuid;
    // /projects/:projectId/... routes
    if (request.params?.projectId) return request.params.projectId;
    // projectId in POST body
    if (request.body?.projectId) return request.body.projectId;
    return undefined;
  }
}
