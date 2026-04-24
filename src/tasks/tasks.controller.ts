import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { CreatePreferenceDto } from './dto/create-preference.dto';
import { MeasureDto } from './dto/measure.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

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
  getPreference(@Param('id') id: string) {
    return this.tasksService.getActivePreference(+id);
  }

  @Post(':id/preference')
  @RequirePermission('tasks:update')
  createPreference(
    @Param('id') id: string,
    @Body() createPreferenceDto: CreatePreferenceDto,
    @Request() req: any,
  ) {
    return this.tasksService.createPreference(+id, createPreferenceDto, req.user.uuid);
  }

  @Post(':id/measure')
  @RequirePermission('measurements:create')
  measure(
    @Param('id') id: string,
    @Body() measureDto: MeasureDto,
    @Request() req: any,
  ) {
    return this.tasksService.measure(+id, measureDto, req.user.uuid);
  }

  @Get(':id/measurements')
  @RequirePermission('measurements:read')
  getMeasurements(@Param('id') id: string) {
    return this.tasksService.getMeasurements(+id);
  }
}
