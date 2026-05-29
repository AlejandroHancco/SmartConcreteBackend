import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { MeasurementChannelsService } from './measurement-channels.service';
import { UpdateMeasurementChannelDto } from './dto/update-measurement-channel.dto';

@Controller('measurements')
@UseGuards(JwtAuthGuard)
export class MeasurementChannelsController {
  constructor(private measurementChannelsService: MeasurementChannelsService) {}

  @Get(':measurementId/channels')
  async getAllChannels(
    @Param('measurementId', ParseIntPipe) measurementId: number,
  ) {
    return this.measurementChannelsService.getAllChannels(measurementId);
  }

  @Patch(':measurementId/channels/:channelNumber')
  async updateChannelMetadata(
    @Param('measurementId', ParseIntPipe) measurementId: number,
    @Param('channelNumber', ParseIntPipe) channelNumber: number,
    @Body() dto: UpdateMeasurementChannelDto,
  ) {
    return this.measurementChannelsService.updateChannelMetadata(
      measurementId,
      channelNumber,
      dto,
    );
  }
}

