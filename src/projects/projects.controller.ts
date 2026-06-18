import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';
import { ProjectsService } from './projects.service';
import { TasksService } from '../tasks/tasks.service';
import { DevicesService } from '../devices/devices.service';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateDeviceDto } from '../devices/dto/create-device.dto';
import { UpdateDeviceDto } from '../devices/dto/update-device.dto';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('projects')
@UseGuards(CombinedAuthGuard)
export class ProjectsController {
    constructor(
        private readonly projectsService: ProjectsService,
        private readonly tasksService: TasksService,
        private readonly devicesService: DevicesService,
    ) {}

    // ── IMPORTANT: rutas estáticas ANTES de :uuid ──────────────────────────────

    @Get('count')
    countByRole(
        @CurrentUser() user: NormalizedUser,
        @Query('role') role: string,
    ) {
        return this.projectsService.countProjectsByRole(user.id, role);
    }

    // ── Proyectos ──────────────────────────────────────────────────────────────

    @Post()
    @RequirePermission('projects:create')
    create(
        @Body() createProjectDto: CreateProjectDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.projectsService.create(createProjectDto, user.id);
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
    update(
        @Param('uuid') uuid: string,
        @Body() updateProjectDto: UpdateProjectDto,
    ) {
        return this.projectsService.update(uuid, updateProjectDto);
    }

    @Delete(':uuid')
    @RequirePermission('projects:delete')
    remove(@Param('uuid') uuid: string) {
        return this.projectsService.remove(uuid);
    }

    // ── Tasks ──────────────────────────────────────────────────────────────────

    @Get(':uuid/tasks')
    @RequirePermission('tasks:read')
    getTasksByProject(
        @Param('uuid') uuid: string,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ) {
        return this.tasksService.findByProject(uuid, Number(page), Number(limit));
    }

    @Post(':uuid/tasks')
    @RequirePermission('tasks:create')
    createTask(
        @Param('uuid') uuid: string,
        @Body() createTaskDto: CreateTaskDto,
    ) {
        return this.tasksService.create({ ...createTaskDto, projectId: uuid });
    }

    // ── Devices ────────────────────────────────────────────────────────────────

    @Get(':uuid/devices')
    @RequirePermission('devices:read')
    getDevicesByProject(@Param('uuid') uuid: string) {
        return this.devicesService.findByProject(uuid);
    }

    @Post(':uuid/devices')
    @RequirePermission('devices:create')
    createDevice(
        @Param('uuid') uuid: string,
        @Body() createDeviceDto: CreateDeviceDto,
    ) {
        return this.devicesService.createInProject(uuid, createDeviceDto);
    }

    @Get(':uuid/devices/:id')
    @RequirePermission('devices:read')
    getDeviceInProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
    ) {
        return this.devicesService.findOneInProject(uuid, id);
    }

    @Patch(':uuid/devices/:id')
    @RequirePermission('devices:update')
    updateDeviceInProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
        @Body() updateDeviceDto: UpdateDeviceDto,
    ) {
        return this.devicesService.updateInProject(uuid, id, updateDeviceDto);
    }

    @Delete(':uuid/devices/:id')
    @RequirePermission('devices:delete')
    deleteDeviceFromProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
    ) {
        return this.devicesService.removeFromProject(uuid, id);
    }
}