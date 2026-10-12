import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';
import { TeamScopeService } from '../common/team-scope.service';
import { MeasurementSchedulingService } from './scheduling.service';
import { CheckAvailabilityDto } from './dto/check-availability.dto';

@Controller('scheduler')
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class SchedulerController {
  constructor(
    private readonly schedulingService: MeasurementSchedulingService,
    private readonly teamScope: TeamScopeService,
  ) {}

  /** Estado actual de la cola (para mostrar en el frontend antes de medir) */
  @Get('status')
  @RequirePermission('measurement:view')
  async getStatus() {
    const backlogSeconds = await this.schedulingService.getBacklogSeconds();
    return {
      backlogSeconds,
      backlogMinutes: Math.ceil(backlogSeconds / 60),
    };
  }

  /**
   * Pre-chequeo de disponibilidad sin encolar: el frontend puede llamarlo
   * al abrir el diálogo de medición para avisar antes del clic.
   */
  @Post('check')
  @RequirePermission('measurement:execute')
  async check(@Body() dto: CheckAvailabilityDto, @CurrentUser() user: NormalizedUser) {
    await this.teamScope.assertTaskInTeam(user.id, dto.taskId);
    return this.schedulingService.checkAvailability(
      dto.taskId,
      dto.ranges,
      dto.selectedChannels,
    );
  }
}
