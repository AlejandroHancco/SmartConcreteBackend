import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DevicesService } from './devices.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { UpdateDeviceStatusDto } from './dto/update-device-status.dto';
import { TestConnectionDto } from './dto/test-connection.dto';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@UseGuards(CombinedAuthGuard, PermissionGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @RequirePermission('device:view')
  findAll(@CurrentUser() user: NormalizedUser) {
    return this.devicesService.findAllForUser(user.id);
  }

  @Post('test-connection')
  @RequirePermission('device:create')
  testConnection(@Body() dto: TestConnectionDto) {
    return this.devicesService.testConnection(dto);
  }
}

@UseGuards(CombinedAuthGuard, PermissionGuard)
@Controller('projects/:projectId/devices')
export class ProjectDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  @RequirePermission('device:view')
  findByProject(
    @Param('projectId') projectId: string,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.findByProject(projectId, user.id);
  }

  @Post()
  @RequirePermission('device:create')
  createInProject(
    @Param('projectId') projectId: string,
    @Body() dto: CreateDeviceDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.createInProject(projectId, dto, user.id);
  }

  @Get(':deviceId')
  @RequirePermission('device:view')
  findOne(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.findOneInProject(projectId, deviceId, user.id);
  }

  @Patch(':deviceId')
  @RequirePermission('device:edit')
  update(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.updateInProject(projectId, deviceId, dto, user.id);
  }

  @Patch(':deviceId/status')
  @RequirePermission('device:edit')
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceStatusDto,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.updateStatusInProject(projectId, deviceId, dto, user.id);
  }

  @Delete(':deviceId')
  @RequirePermission('device:delete')
  remove(
    @Param('projectId') projectId: string,
    @Param('deviceId') deviceId: string,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.devicesService.removeFromProject(projectId, deviceId, user.id);
  }
}
