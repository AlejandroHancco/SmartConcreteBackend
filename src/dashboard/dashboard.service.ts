import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamScopeService } from '../common/team-scope.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private teamScope: TeamScopeService,
    private notificationsService: NotificationsService,
  ) {}

  async getRecentActivity(userId: string) {
    const teamId = await this.teamScope.getTeamId(userId);
    return this.notificationsService.findRecentActivityForTeam(teamId, 10);
  }

  async getDashboardStats(userId: string) {
    const teamId = await this.teamScope.getTeamId(userId);
    const teamProjectWhere = this.teamScope.projectTeamWhere(teamId);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalDevices,
      activeProjects,
      teamMembers,
      newDevicesThisWeek,
      pendingJobs,
    ] = await Promise.all([
      this.prisma.device.count({
        where: { project: teamProjectWhere },
      }),
      this.prisma.project.count({
        where: { status: 'active', ...teamProjectWhere },
      }),
      this.prisma.teamMember.count({
        where: { teamId, status: 'APPROVED' },
      }),
      this.prisma.device.count({
        where: {
          project: teamProjectWhere,
          createdAt: { gte: oneWeekAgo },
        },
      }),
      this.prisma.scheduledJob.count({
        where: {
          status: 'pending',
          task: { project: teamProjectWhere },
        },
      }),
    ]);

    return {
      totalDevices,
      activeProjects,
      teamMembers,
      newDevicesThisWeek,
      pendingJobs,
    };
  }
}
