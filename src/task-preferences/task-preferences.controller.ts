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
import { TaskPreferencesService } from './task-preferences.service';
import { CreateTaskPreferenceDto } from './dto/create-task-preference.dto';
import { UpdateTaskPreferenceDto } from './dto/update-task-preference.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('task-preferences')
@UseGuards(JwtAuthGuard)
export class TaskPreferencesController {
  constructor(private readonly taskPreferencesService: TaskPreferencesService) {}

  @Post()
  @RequirePermission('tasks:update') // Asumiendo que crear preferencias es parte de actualizar tareas
  create(@Body() createTaskPreferenceDto: CreateTaskPreferenceDto) {
    return this.taskPreferencesService.create(createTaskPreferenceDto);
  }

  @Get()
  @RequirePermission('tasks:read')
  findAll() {
    return this.taskPreferencesService.findAll();
  }

  @Get('active/:taskId')
  @RequirePermission('tasks:read')
  getActivePreference(@Param('taskId') taskId: string) {
    return this.taskPreferencesService.getActivePreference(+taskId);
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  findOne(@Param('id') id: string) {
    return this.taskPreferencesService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermission('tasks:update')
  update(@Param('id') id: string, @Body() updateTaskPreferenceDto: UpdateTaskPreferenceDto) {
    return this.taskPreferencesService.update(+id, updateTaskPreferenceDto);
  }

  @Delete(':id')
  @RequirePermission('tasks:delete')
  remove(@Param('id') id: string) {
    return this.taskPreferencesService.remove(+id);
  }
}
