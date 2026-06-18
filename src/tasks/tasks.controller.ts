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
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly taskPreferencesService: TaskPreferencesService,
  ) {}

  @Post()
  @RequirePermission('tasks:create')
  create(@Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  @RequirePermission('tasks:read')
  findAll() {
    return this.tasksService.findAll();
  }

  @Get(':id')
  @RequirePermission('tasks:read')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOneWithPreference(+id);
  }

  @Patch(':id')
  @RequirePermission('tasks:update')
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto) {
    return this.tasksService.update(+id, updateTaskDto);
  }

  @Delete(':id')
  @RequirePermission('tasks:delete')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(+id);
  }

  @Get(':id/preference')
  @RequirePermission('tasks:read')
  getPreference(@Param('id', ParseIntPipe) id: number) {
    return this.taskPreferencesService.getTaskPreference(id);
  }

  @Post(':id/preference')
  @RequirePermission('tasks:update')
  createPreference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.createTaskPreference(id, dto);
  }

  @Put(':id/preference')
  @RequirePermission('tasks:update')
  updatePreference(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskPreferenceDto,
  ) {
    return this.taskPreferencesService.updateTaskPreference(id, dto);
  }

  @Delete(':id/preference')
  @RequirePermission('tasks:delete')
  removePreference(@Param('id', ParseIntPipe) id: number) {
    return this.taskPreferencesService.removeTaskPreference(id);
  }

  @Post(':id/measure')
  @RequirePermission('measurements:create')
  measure(@Param('id') id: string, @Body() measureDto: MeasureDto, @Request() req: any) {
    return this.tasksService.measure(+id, measureDto, req.user.id);
  }

  @Get(':id/measurements')
  @RequirePermission('measurements:read')
  getMeasurements(@Param('id') id: string) {
    return this.tasksService.getMeasurements(+id);
  }
}
