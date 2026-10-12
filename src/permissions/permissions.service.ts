import { ForbiddenException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

// Fallback en memoria (por rol) cuando Redis no está disponible
const rolePermissionCache = new Map<number, { permissions: string[]; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

/** TTL del caché de permisos por usuario en Redis (segundos) */
const REDIS_PERMISSIONS_TTL = 300;

@Injectable()
export class PermissionsService {
  private readonly logger = new Logger(PermissionsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private redis: Redis | null,
  ) {}

  private userCacheKey(userId: string, projectId?: string): string {
    return `permissions:${userId}:${projectId ?? 'global'}`;
  }

  async getPermissionsForRole(roleId: number): Promise<string[]> {
    const cached = rolePermissionCache.get(roleId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.permissions;
    }

    const rows = await this.prisma.rolePermission.findMany({
      where: { roleId },
      select: { permissionId: true },
    });

    const permissions = rows.map(r => r.permissionId);
    rolePermissionCache.set(roleId, { permissions, expiresAt: Date.now() + CACHE_TTL });
    return permissions;
  }

  /**
   * Permisos efectivos de un usuario (con caché en Redis, TTL 300s).
   * Fallback a DB + caché en memoria por rol si Redis no está disponible.
   */
  async getUserPermissions(userId: string, projectId?: string): Promise<string[]> {
    const cacheKey = this.userCacheKey(userId, projectId);

    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (err) {
        this.logger.warn(`Redis GET failed (${err.message}) — leyendo de DB`);
      }
    }

    const permissions = await this.getPermissionsFromDB(userId, projectId);

    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, REDIS_PERMISSIONS_TTL, JSON.stringify(permissions));
      } catch (err) {
        this.logger.warn(`Redis SETEX failed: ${err.message}`);
      }
    }

    return permissions;
  }

  /** Roles globales de un usuario (sin scope de proyecto): sus UserProjectRole + el mapeo de TeamRole.ADMIN. */
  private async getGlobalRoleIds(userId: string): Promise<Set<number>> {
    const roleIds = new Set<number>();

    const uprs = await this.prisma.userProjectRole.findMany({
      where: { userId },
      select: { roleId: true },
    });
    uprs.forEach(u => roleIds.add(u.roleId));

    // Map TeamRole.ADMIN → "Administrador de Equipo" platform role
    const teamMember = await this.prisma.teamMember.findFirst({
      where: { userId, status: 'APPROVED' },
      select: { role: true },
    });
    if (teamMember?.role === 'ADMIN') {
      const adminRole = await this.prisma.role.findUnique({
        where: { name: 'Administrador de Equipo' },
        select: { id: true },
      });
      if (adminRole) roleIds.add(adminRole.id);
    }

    return roleIds;
  }

  /** Nombres de los roles globales de un usuario (ignora el scope de proyecto). */
  async getUserRoleNames(userId: string): Promise<string[]> {
    const roleIds = await this.getGlobalRoleIds(userId);
    if (roleIds.size === 0) return [];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: Array.from(roleIds) } },
      select: { name: true },
    });
    return roles.map(r => r.name);
  }

  /**
   * Roles que, sin ser Super Administrador, pueden editar permisos de otros roles,
   * pero únicamente de los roles listados aquí (para evitar que se autoescalen privilegios).
   */
  private static readonly ROLE_EDITORS: Record<string, string[]> = {
    'Administrador de Equipo': ['Operario'],
    'Gestor de Proyecto': ['Operario'],
  };

  /** Permisos de administración del propio sistema de roles: nunca otorgables salvo por un Super Administrador. */
  private static readonly SYSTEM_PERMISSIONS = new Set(['permission:edit', 'role:edit']);

  /**
   * Lanza ForbiddenException si `userId` no puede editar los permisos del rol `targetRoleId`,
   * o si intenta otorgar permisos de administración del sistema (permission:edit / role:edit)
   * sin ser Super Administrador.
   */
  async assertCanManageRolePermissions(
    userId: string,
    targetRoleId: number,
    newPermissions: string[],
  ): Promise<void> {
    const roleNames = await this.getUserRoleNames(userId);
    if (roleNames.includes('Super Administrador')) return;

    const targetRole = await this.prisma.role.findUnique({
      where: { id: targetRoleId },
      select: { name: true },
    });

    const canEditTarget = roleNames.some(name =>
      PermissionsService.ROLE_EDITORS[name]?.includes(targetRole?.name ?? ''),
    );

    if (!canEditTarget) {
      throw new ForbiddenException(
        'No tienes permiso para modificar los permisos de este rol',
      );
    }

    const grantsSystemPermission = newPermissions.some(p =>
      PermissionsService.SYSTEM_PERMISSIONS.has(p),
    );
    if (grantsSystemPermission) {
      throw new ForbiddenException(
        'No puedes otorgar permisos de administración de roles/permisos',
      );
    }
  }

  /** Permisos extra ("IAM binding") otorgados directamente a un usuario dentro de un proyecto. */
  async getExtraPermissions(userId: string, projectId: string): Promise<string[]> {
    const rows = await this.prisma.userProjectPermission.findMany({
      where: { userId, projectId },
      select: { permissionId: true },
    });
    return rows.map(r => r.permissionId);
  }

  /**
   * Lanza ForbiddenException si `callerId` no puede otorgar permisos extra a `targetUserId`
   * dentro de `projectId`, o si intenta otorgar permisos de administración del sistema.
   */
  async assertCanManageMemberPermissions(
    callerId: string,
    projectId: string,
    targetUserId: string,
    newPermissions: string[],
  ): Promise<void> {
    const callerRoleNames = await this.getUserRoleNames(callerId);

    if (!callerRoleNames.includes('Super Administrador')) {
      const allowedTargetRoles = new Set(
        callerRoleNames.flatMap(name => PermissionsService.ROLE_EDITORS[name] ?? []),
      );

      const targetRole = await this.prisma.userProjectRole.findUnique({
        where: { userId_projectId: { userId: targetUserId, projectId } },
        select: { role: { select: { name: true } } },
      });

      if (allowedTargetRoles.size === 0 || !targetRole || !allowedTargetRoles.has(targetRole.role.name)) {
        throw new ForbiddenException(
          'No tienes permiso para modificar los permisos de este miembro',
        );
      }

      const grantsSystemPermission = newPermissions.some(p =>
        PermissionsService.SYSTEM_PERMISSIONS.has(p),
      );
      if (grantsSystemPermission) {
        throw new ForbiddenException(
          'No puedes otorgar permisos de administración de roles/permisos',
        );
      }
    }
  }

  /** Reemplaza el conjunto completo de permisos extra de un usuario dentro de un proyecto. */
  async setExtraPermissions(
    userId: string,
    projectId: string,
    permissions: string[],
  ): Promise<string[]> {
    await this.prisma.$transaction([
      this.prisma.userProjectPermission.deleteMany({ where: { userId, projectId } }),
      this.prisma.userProjectPermission.createMany({
        data: permissions.map(permissionId => ({ userId, projectId, permissionId })),
      }),
    ]);
    await this.invalidateUserCache(userId);
    return this.getExtraPermissions(userId, projectId);
  }

  private async getPermissionsFromDB(userId: string, projectId?: string): Promise<string[]> {
    let roleIds: Set<number>;

    if (projectId) {
      const upr = await this.prisma.userProjectRole.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { roleId: true },
      });
      if (upr) {
        roleIds = new Set([upr.roleId]);
      } else {
        // Sin rol explícito en el proyecto → fallback al scope global
        // (el aislamiento entre equipos lo garantiza TeamScopeService en cada service)
        return this.getPermissionsFromDB(userId);
      }
    } else {
      roleIds = await this.getGlobalRoleIds(userId);
    }

    const permissions = new Set<string>();
    for (const id of roleIds) {
      const perms = await this.getPermissionsForRole(id);
      perms.forEach(p => permissions.add(p));
    }

    // Permisos extra otorgados directamente al usuario (por proyecto, estilo "IAM binding").
    const extraWhere = projectId ? { userId, projectId } : { userId };
    const extras = await this.prisma.userProjectPermission.findMany({
      where: extraWhere,
      select: { permissionId: true },
    });
    extras.forEach(e => permissions.add(e.permissionId));

    return Array.from(permissions);
  }

  async hasPermission(userId: string, permission: string, projectId?: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, projectId);
    return permissions.includes(permission);
  }

  /**
   * Invalida el caché de permisos de un usuario inmediatamente.
   * Llamar cuando cambia su rol (aprobación, cambio de rol de equipo/proyecto).
   */
  async invalidateUserCache(userId: string): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys(`permissions:${userId}:*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`Redis invalidation failed for user ${userId}: ${err.message}`);
    }
  }

  invalidateRoleCache(roleId: number): void {
    rolePermissionCache.delete(roleId);
  }

  /** Al editar los permisos de un rol se invalida el caché de todos los usuarios */
  private async invalidateAllUserCaches(): Promise<void> {
    if (!this.redis) return;
    try {
      const keys = await this.redis.keys('permissions:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      this.logger.warn(`Redis full invalidation failed: ${err.message}`);
    }
  }

  async findAll() {
    return this.prisma.permission.findMany({ orderBy: { id: 'asc' } });
  }

  async findAllRoles() {
    const roles = await this.prisma.role.findMany({
      include: {
        rolePermissions: { include: { permission: true } },
      },
      orderBy: { id: 'asc' },
    });
    return roles.map(role => ({
      id: role.id,
      name: role.name,
      permissions: role.rolePermissions.map(rp => rp.permission),
    }));
  }

  async updateRolePermissions(roleId: number, permissions: string[]) {
    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map(permissionId => ({ roleId, permissionId })),
      }),
    ]);
    this.invalidateRoleCache(roleId);
    await this.invalidateAllUserCaches();
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return role && {
      id: role.id,
      name: role.name,
      permissions: role.rolePermissions.map(rp => rp.permission),
    };
  }
}
