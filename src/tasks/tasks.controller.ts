import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { MeasureDto } from './dto/measure.dto';
import { TaskPreferencesService } from '../task-preferences/task-preferences.service';
import { CreateTaskPreferenceDto } from '../task-preferences/dto/create-task-preference.dto';
import { UpdateTaskPreferenceDto } from '../task-preferences/dto/update-task-preference.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskPreferencesService: TaskPreferencesService,
  ) {}

  @Post()
  @RequirePermission('task:create')
  create(@Body() createTaskDto: CreateTaskDto, @Request() req: any) {
    return this.tasksService.create(createTaskDto, req.user.id);
  }

  @Get()
  @RequirePermission('task:view')
  findAll(@Request() req: any) {
    return this.tasksService.findAll(req.user.id);
  }

  @Get(':id')
  @RequirePermission('task:view')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.tasksService.findOneWithPreference(+id, req.user.id);
  }

  @Patch(':id')
  @RequirePermission('task:edit')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Request() req: any) {
    return this.tasksService.update(+id, updateTaskDto, req.user.id);
  }

  @Delete(':id')
  @RequirePermission('task:delete')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.tasksService.remove(+id, req.user.id);
  }

  @Get(':id/preference')
  @RequirePermission('task:view')
  getPreference(@Param('id', ParseIntPipe) id: number) {
    return this.taskPreferencesService.getTaskPreference(id);
  }

  @Post(':id/preference')
  @RequirePermission('task:edit')
  createPreference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.createTaskPreference(id, dto);
  }

  @Put(':id/preference')
  @RequirePermission('task:edit')
  updatePreference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.updateTaskPreference(id, dto);
  }

  @Delete(':id/preference')
  @RequirePermission('task:delete')
  removePreference(@Param('id', ParseIntPipe) id: number) {
    return this.taskPreferencesService.removeTaskPreference(id);
  }

  @Post(':id/measure')
  @RequirePermission('measurement:execute')
  measure(@Param('id') id: string, @Body() measureDto: MeasureDto, @Request() req: any) {
    return this.tasksService.measure(+id, measureDto, req.user.id);
  }

  @Get(':id/measurements')
  @RequirePermission('measurement:view')
  getMeasurements(@Param('id') id: string, @Request() req: any) {
    return this.tasksService.getMeasurements(+id, req.user.id);
  }
}
