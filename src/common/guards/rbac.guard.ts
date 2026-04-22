import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const permission = this.reflector.get<string>(
      REQUIRE_PERMISSION_KEY,
      context.getHandler(),
    );
    if (!permission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      return false;
    }

    // Obtener projectId del param o body
    const projectId = request.params.projectId || request.body.projectId;
    if (!projectId) {
      return false;
    }

    // Llamar a la función has_permission
    const result = await this.prisma.$queryRaw<{ has_permission: boolean }[]>`
      SELECT platform.has_permission(${user.uuid}, ${projectId}, ${permission}) as has_permission
    `;
    return result[0]?.has_permission || false;
  }
}
