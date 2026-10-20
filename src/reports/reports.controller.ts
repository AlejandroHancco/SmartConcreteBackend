import { Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tasks')
  @RequirePermission('report:view')
  listTasks(
    @CurrentUser() user: NormalizedUser,
    @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string,
  ) {
    return this.reportsService.listTasks(user.id, projectId || undefined);
  }

  @Get('task/:taskId')
  @RequirePermission('report:export')
  getTaskReport(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: NormalizedUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getTaskReport(user.id, taskId, this.reportsService.parseRange(from, to));
  }

  @Get('task/:taskId/csv')
  @RequirePermission('report:export')
  async taskCsv(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: NormalizedUser,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // parseRange corre (y puede lanzar 400) antes de que streamTaskCsv escriba cualquier encabezado.
    const range = this.reportsService.parseRange(from, to);
    await this.reportsService.streamTaskCsv(user.id, taskId, range, res);
  }

  @Get('measurement/:id/csv')
  @RequirePermission('report:export')
  async measurementCsv(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NormalizedUser,
    @Res() res: Response,
  ) {
    const file = await this.reportsService.measurementCsv(user.id, id);
    this.sendCsv(res, file);
  }

  private sendCsv(res: Response, file: { filename: string; content: string }) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.content);
  }
}
