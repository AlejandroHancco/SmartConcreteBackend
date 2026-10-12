import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
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

  private async getPermissionsFromDB(userId: string, projectId?: string): Promise<string[]> {
    const roleIds = new Set<number>();

    if (projectId) {
      const upr = await this.prisma.userProjectRole.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { roleId: true },
      });
      if (upr) {
        roleIds.add(upr.roleId);
      } else {
        // Sin rol explícito en el proyecto → fallback al scope global
        // (el aislamiento entre equipos lo garantiza TeamScopeService en cada service)
        return this.getPermissionsFromDB(userId);
      }
    } else {
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
    }

    const permissions = new Set<string>();
    for (const id of roleIds) {
      const perms = await this.getPermissionsForRole(id);
      perms.forEach(p => permissions.add(p));
    }
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
    return this.prisma.role.findMany({
      include: {
        rolePermissions: { select: { permissionId: true } },
      },
      orderBy: { id: 'asc' },
    });
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
    return this.prisma.role.findUnique({
      where: { id: roleId },
      include: { rolePermissions: { select: { permissionId: true } } },
    });
  }
}
