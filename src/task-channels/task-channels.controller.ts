import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TaskChannelsService } from './task-channels.service';
import { UpdateTaskChannelDto } from './dto/update-task-channel.dto';

@Controller('tasks')
export class TaskChannelsController {
  constructor(private taskChannelsService: TaskChannelsService) {}

  @Get(':taskId/channels')
  async getTaskChannels(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskChannelsService.getTaskChannels(taskId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':taskId/channels/:channelNumber')
  async updateTaskChannel(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Param('channelNumber', ParseIntPipe) channelNumber: number,
    @Body() dto: UpdateTaskChannelDto,
  ) {
    return this.taskChannelsService.updateTaskChannel(
      taskId,
      channelNumber,
      dto,
    );
  }
}
