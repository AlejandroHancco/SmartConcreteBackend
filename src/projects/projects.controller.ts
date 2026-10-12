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
    Request,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';
import { ProjectsService } from './projects.service';
import { TasksService } from '../tasks/tasks.service';
import { DevicesService } from '../devices/devices.service';
import { CreateTaskDto } from '../tasks/dto/create-task.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UpdateProjectMemberRoleDto } from './dto/update-project-member-role.dto';
import { UpdateProjectMemberPermissionsDto } from './dto/update-project-member-permissions.dto';
import { CreateDeviceDto } from '../devices/dto/create-device.dto';
import { UpdateDeviceDto } from '../devices/dto/update-device.dto';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('projects')
@UseGuards(CombinedAuthGuard, PermissionGuard)
export class ProjectsController {
    constructor(
        private readonly projectsService: ProjectsService,
        private readonly tasksService: TasksService,
        private readonly devicesService: DevicesService,
    ) {}

    // ── Rutas estáticas ANTES de :uuid ─────────────────────────────────────────

    @Get('count')
    @RequirePermission('project:view')
    countByRole(
        @CurrentUser() user: NormalizedUser,
        @Query('role') role: string,
    ) {
        return this.projectsService.countProjectsByRole(user.id, role);
    }

    // ── Proyectos ──────────────────────────────────────────────────────────────

    @Post()
    @RequirePermission('project:create')
    create(
        @Body() createProjectDto: CreateProjectDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.projectsService.create(createProjectDto, user.id);
    }

    @Get()
    @RequirePermission('project:view')
    findAll(@CurrentUser() user: NormalizedUser) {
        return this.projectsService.findByTeam(user.id);
    }

    @Get(':uuid')
    @RequirePermission('project:view')
    findOne(@Param('uuid') uuid: string, @CurrentUser() user: NormalizedUser) {
        return this.projectsService.findOne(uuid, user.id);
    }

    @Patch(':uuid')
    @RequirePermission('project:edit')
    update(
        @Param('uuid') uuid: string,
        @Body() updateProjectDto: UpdateProjectDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.projectsService.update(uuid, updateProjectDto, user.id);
    }

    @Delete(':uuid')
    @RequirePermission('project:delete')
    remove(@Param('uuid') uuid: string, @CurrentUser() user: NormalizedUser) {
        return this.projectsService.remove(uuid, user);
    }

    // ── Miembros del proyecto ──────────────────────────────────────────────────

    @Get(':uuid/members')
    @RequirePermission('project:view')
    getProjectMembers(@Param('uuid') uuid: string, @CurrentUser() user: NormalizedUser) {
        return this.projectsService.getProjectMembers(uuid, user.id);
    }

    @Patch(':uuid/members/:userId/role')
    @RequirePermission('project:edit')
    updateProjectMemberRole(
        @Param('uuid') uuid: string,
        @Param('userId') userId: string,
        @Body() body: UpdateProjectMemberRoleDto,
        @Request() req: any,
    ) {
        return this.projectsService.updateProjectMemberRole(uuid, userId, body.roleId, req.user);
    }

    @Patch(':uuid/members/:userId/permissions')
    @RequirePermission('project:edit')
    updateProjectMemberPermissions(
        @Param('uuid') uuid: string,
        @Param('userId') userId: string,
        @Body() body: UpdateProjectMemberPermissionsDto,
        @Request() req: any,
    ) {
        return this.projectsService.updateProjectMemberPermissions(uuid, userId, body.permissions, req.user);
    }

    // ── Tasks ──────────────────────────────────────────────────────────────────

    @Get(':uuid/tasks')
    @RequirePermission('task:view')
    getTasksByProject(
        @Param('uuid') uuid: string,
        @CurrentUser() user: NormalizedUser,
        @Query('page') page: string = '1',
        @Query('limit') limit: string = '10',
    ) {
        return this.tasksService.findByProject(uuid, user.id, Number(page), Number(limit));
    }

    @Post(':uuid/tasks')
    @RequirePermission('task:create')
    createTask(
        @Param('uuid') uuid: string,
        @Body() createTaskDto: CreateTaskDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.tasksService.create({ ...createTaskDto, projectId: uuid }, user.id);
    }

    // ── Devices ────────────────────────────────────────────────────────────────

    @Get(':uuid/devices')
    @RequirePermission('device:view')
    getDevicesByProject(@Param('uuid') uuid: string, @CurrentUser() user: NormalizedUser) {
        return this.devicesService.findByProject(uuid, user.id);
    }

    @Post(':uuid/devices')
    @RequirePermission('device:create')
    createDevice(
        @Param('uuid') uuid: string,
        @Body() createDeviceDto: CreateDeviceDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.devicesService.createInProject(uuid, createDeviceDto, user.id);
    }

    @Get(':uuid/devices/:id')
    @RequirePermission('device:view')
    getDeviceInProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.devicesService.findOneInProject(uuid, id, user.id);
    }

    @Patch(':uuid/devices/:id')
    @RequirePermission('device:edit')
    updateDeviceInProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
        @Body() updateDeviceDto: UpdateDeviceDto,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.devicesService.updateInProject(uuid, id, updateDeviceDto, user.id);
    }

    @Delete(':uuid/devices/:id')
    @RequirePermission('device:delete')
    deleteDeviceFromProject(
        @Param('uuid') uuid: string,
        @Param('id') id: string,
        @CurrentUser() user: NormalizedUser,
    ) {
        return this.devicesService.removeFromProject(uuid, id, user.id);
    }
}
