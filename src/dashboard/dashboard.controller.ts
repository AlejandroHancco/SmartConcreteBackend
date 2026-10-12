import { Controller, Get, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@Controller('dashboard')
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @RequirePermission('project:view')
  getStats(@CurrentUser() user: NormalizedUser) {
    return this.dashboardService.getDashboardStats(user.id);
  }

  @Get('recent-activity')
  @RequirePermission('project:view')
  getRecentActivity(@CurrentUser() user: NormalizedUser) {
    return this.dashboardService.getRecentActivity(user.id);
  }
}
