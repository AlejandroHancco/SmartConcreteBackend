import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('scheduled-jobs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ScheduledJobsController {
  constructor(private readonly scheduledJobsService: ScheduledJobsService) {}

  @Post()
  @RequirePermission('measurement:schedule')
  create(
    @Body() createScheduledJobDto: CreateScheduledJobDto,
    @Request() req: any,
  ) {
    return this.scheduledJobsService.create(createScheduledJobDto, req.user.id);
  }

  @Get()
  @RequirePermission('measurement:view')
  findAll(@Request() req: any) {
    return this.scheduledJobsService.findAll(req.user.id);
  }

  @Get(':id')
  @RequirePermission('measurement:view')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.scheduledJobsService.findOne(+id, req.user.id);
  }

  @Delete(':id')
  @RequirePermission('measurement:schedule')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.scheduledJobsService.remove(+id, req.user.id);
  }
}
