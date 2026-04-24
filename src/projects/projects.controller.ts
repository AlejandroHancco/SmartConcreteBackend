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
import { ProjectsService } from './projects.service';
import { TasksService } from '../tasks/tasks.service';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
      private readonly projectsService: ProjectsService,
      private readonly tasksService: TasksService,
  ) {}
  @Post()
  @RequirePermission('projects:create')
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  @RequirePermission('projects:read')
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(':uuid')
  @RequirePermission('projects:read')
  findOne(@Param('uuid') uuid: string) {
    return this.projectsService.findOne(uuid);
  }

  @Patch(':uuid')
  @RequirePermission('projects:update')
  update(@Param('uuid') uuid: string, @Body() updateProjectDto: UpdateProjectDto) {
    return this.projectsService.update(uuid, updateProjectDto);
  }

  @Delete(':uuid')
  @RequirePermission('projects:delete')
  remove(@Param('uuid') uuid: string) {
    return this.projectsService.remove(uuid);
  }
  @Get(':uuid/tasks')
  @RequirePermission('tasks:read')
  getTasksByProject(@Param('uuid') uuid: string) {
    return this.tasksService.findByProject(uuid);
  }
  @Post(':uuid/tasks')
  @RequirePermission('tasks:create')
  createTask(@Param('uuid') uuid: string, @Body() createTaskDto: CreateTaskDto) {
    return this.tasksService.create({ ...createTaskDto, projectId: uuid });
  }
}
