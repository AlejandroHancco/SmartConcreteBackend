import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateTaskPreferenceDto } from './dto/create-task-preference.dto';
import { UpdateTaskPreferenceDto } from './dto/update-task-preference.dto';
import { TaskPreferencesService } from './task-preferences.service';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskPreferencesController {
  constructor(private readonly taskPreferencesService: TaskPreferencesService) {}

  @Get(':taskId/preference')
  getTaskPreference(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskPreferencesService.getTaskPreference(taskId);
  }

  @Post(':taskId/preference')
  createTaskPreference(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() createTaskPreferenceDto: CreateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.createTaskPreference(
      taskId,
      createTaskPreferenceDto,
    );
  }

  @Put(':taskId/preference')
  updateTaskPreference(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() updateTaskPreferenceDto: UpdateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.updateTaskPreference(
      taskId,
      updateTaskPreferenceDto,
    );
  }

  @Delete(':taskId/preference')
  removeTaskPreference(@Param('taskId', ParseIntPipe) taskId: number) {
    return this.taskPreferencesService.removeTaskPreference(taskId);
  }
}
