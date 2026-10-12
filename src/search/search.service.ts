import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { PermissionsService } from '../permissions/permissions.service';

export interface SearchResult {
  type: 'project' | 'device' | 'member' | 'task';
  id: string;
  label: string;
  subtitle?: string;
  href: string;
}

const MAX_PER_CATEGORY = 5;

@Injectable()
export class SearchService {
  constructor(
    private prisma: PrismaService,
    private teamScope: TeamScopeService,
    private permissionsService: PermissionsService,
  ) {}

  async search(userId: string, query: string): Promise<SearchResult[]> {
    const q = query?.trim();
    if (!q) return [];

    let teamId: string;
    try {
      teamId = await this.teamScope.getTeamId(userId);
    } catch {
      return [];
    }

    const projectWhere = this.teamScope.projectTeamWhere(teamId);

    const [canViewProjects, canViewDevices, canViewTeam, canViewTasks] = await Promise.all([
      this.permissionsService.hasPermission(userId, 'project:view'),
      this.permissionsService.hasPermission(userId, 'device:view'),
      this.permissionsService.hasPermission(userId, 'team:view'),
      this.permissionsService.hasPermission(userId, 'task:view'),
    ]);

    const [projects, devices, members, tasks] = await Promise.all([
      canViewProjects
        ? this.prisma.project.findMany({
            where: { ...projectWhere, name: { contains: q, mode: 'insensitive' } },
            select: { uuid: true, name: true },
            take: MAX_PER_CATEGORY,
          })
        : Promise.resolve([]),
      canViewDevices
        ? this.prisma.device.findMany({
            where: {
              project: projectWhere,
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { ip: { contains: q, mode: 'insensitive' } },
              ],
            },
            include: { project: { select: { name: true } } },
            take: MAX_PER_CATEGORY,
          })
        : Promise.resolve([]),
      canViewTeam
        ? this.prisma.teamMember.findMany({
            where: {
              teamId,
              status: 'APPROVED',
              user: {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  { lastName: { contains: q, mode: 'insensitive' } },
                  { email: { contains: q, mode: 'insensitive' } },
                ],
              },
            },
            include: { user: { select: { uuid: true, name: true, lastName: true, email: true } } },
            take: MAX_PER_CATEGORY,
          })
        : Promise.resolve([]),
      canViewTasks
        ? this.prisma.task.findMany({
            where: { project: projectWhere, name: { contains: q, mode: 'insensitive' } },
            include: { project: { select: { name: true } } },
            take: MAX_PER_CATEGORY,
          })
        : Promise.resolve([]),
    ]);

    const results: SearchResult[] = [];

    results.push(
      ...projects.map((p) => ({
        type: 'project' as const,
        id: p.uuid,
        label: p.name,
        href: `/projects/${p.uuid}`,
      })),
    );

    results.push(
      ...devices.map((d) => ({
        type: 'device' as const,
        id: d.id,
        label: d.name ?? d.ip ?? 'Dispositivo',
        subtitle: d.project?.name,
        href: `/projects/${d.projectId}/devices`,
      })),
    );

    results.push(
      ...members.map((m) => ({
        type: 'member' as const,
        id: m.user.uuid,
        label: `${m.user.name} ${m.user.lastName ?? ''}`.trim(),
        subtitle: m.user.email,
        href: `/team/${teamId}`,
      })),
    );

    results.push(
      ...tasks.map((t) => ({
        type: 'task' as const,
        id: String(t.id),
        label: t.name,
        subtitle: t.project?.name,
        href: `/projects/${t.projectId}/tasks/${t.id}`,
      })),
    );

    return results;
  }
}
