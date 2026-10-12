import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { UpdateMeasurementDto } from './dto/update-measurement.dto';
import { UpdateMeasurementChannelDto } from './dto/update-measurement-channel.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@Controller('measurements')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Post()
  @RequirePermission('measurement:execute')
  create(
    @Body() createMeasurementDto: CreateMeasurementDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.measurementsService.create(createMeasurementDto, user.id);
  }

  @Get()
  @RequirePermission('measurement:view')
  findAll(@CurrentUser() user: NormalizedUser) {
    return this.measurementsService.findAll(user.id);
  }

  @Get('latest')
  @RequirePermission('measurement:view')
  getLatest(@CurrentUser() user: NormalizedUser) {
    return this.measurementsService.getLatest(user.id);
  }

  @Get('task/:taskId')
  @RequirePermission('measurement:view')
  findByTask(@Param('taskId') taskId: string, @CurrentUser() user: NormalizedUser) {
    return this.measurementsService.findByTask(+taskId, user.id);
  }

  @Get(':id')
  @RequirePermission('measurement:view')
  findOne(@Param('id') id: string, @CurrentUser() user: NormalizedUser) {
    return this.measurementsService.findOne(+id, user.id);
  }

  @Patch(':id')
  @RequirePermission('measurement:view')
  update(
    @Param('id') id: string,
    @Body() updateMeasurementDto: UpdateMeasurementDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.measurementsService.update(+id, updateMeasurementDto, user.id);
  }

  @Delete(':id')
  @RequirePermission('measurement:delete')
  remove(@Param('id') id: string, @CurrentUser() user: NormalizedUser) {
    return this.measurementsService.remove(+id, user.id);
  }

  @Patch(':id/channels/:channelNumber')
  @RequirePermission('measurement:view')
  updateMeasurementChannel(
    @Param('id') id: string,
    @Param('channelNumber') channelNumber: string,
    @Body() updateMeasurementChannelDto: UpdateMeasurementChannelDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.measurementsService.updateMeasurementChannelMetadata(
      +id,
      +channelNumber,
      user.id,
      updateMeasurementChannelDto,
    );
  }
}
