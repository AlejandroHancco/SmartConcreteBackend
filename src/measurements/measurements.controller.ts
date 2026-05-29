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
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('measurements')
@UseGuards(JwtAuthGuard)
export class MeasurementsController {
  constructor(private readonly measurementsService: MeasurementsService) {}

  @Post()
  @RequirePermission('measurements:create')
  create(@Body() createMeasurementDto: CreateMeasurementDto) {
    return this.measurementsService.create(createMeasurementDto);
  }

  @Get()
  @RequirePermission('measurements:read')
  findAll() {
    return this.measurementsService.findAll();
  }

  @Get('task/:taskId')
  @RequirePermission('measurements:read')
  findByTask(@Param('taskId') taskId: string) {
    return this.measurementsService.findByTask(+taskId);
  }

  @Get(':id')
  @RequirePermission('measurements:read')
  findOne(@Param('id') id: string) {
    return this.measurementsService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermission('measurements:update')
  update(@Param('id') id: string, @Body() updateMeasurementDto: UpdateMeasurementDto) {
    return this.measurementsService.update(+id, updateMeasurementDto);
  }

  @Delete(':id')
  @RequirePermission('measurements:delete')
  remove(@Param('id') id: string) {
    return this.measurementsService.remove(+id);
  }

  @Patch(':id/channels/:channelNumber')
  @RequirePermission('measurements:update')
  updateMeasurementChannel(
    @Param('id') id: string,
    @Param('channelNumber') channelNumber: string,
    @Body() updateMeasurementChannelDto: UpdateMeasurementChannelDto,
  ) {
    return this.measurementsService.updateMeasurementChannelMetadata(
      +id,
      +channelNumber,
      updateMeasurementChannelDto,
    );
  }
}
