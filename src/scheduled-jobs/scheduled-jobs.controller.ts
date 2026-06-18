import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('scheduled-jobs')
@UseGuards(JwtAuthGuard)
export class ScheduledJobsController {
  constructor(private readonly scheduledJobsService: ScheduledJobsService) {}

  @Post()
  @RequirePermission('measurements:create')
  create(
    @Body() createScheduledJobDto: CreateScheduledJobDto,
    @Request() req: any,
  ) {
    return this.scheduledJobsService.create(createScheduledJobDto, req.user.uuid);
  }

  @Get()
  @RequirePermission('measurements:read')
  findAll() {
    return this.scheduledJobsService.findAll();
  }

  @Get(':id')
  @RequirePermission('measurements:read')
  findOne(@Param('id') id: string) {
    return this.scheduledJobsService.findOne(+id);
  }
}
