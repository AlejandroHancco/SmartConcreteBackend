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
import { TestConnectionDto } from './dto/test-connection.dto';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

// ── GET /devices  &  POST /devices/test-connection ────────────────────────────
@UseGuards(CombinedAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findAll(@CurrentUser() user: NormalizedUser) {
    return this.devicesService.findAllForUser(user.id);
  }

  @Post('test-connection')
  testConnection(@Body() dto: TestConnectionDto) {
    return this.devicesService.testConnection(dto);
  }
}

// ── /projects/:projectId/devices/* ────────────────────────────────────────────
@UseGuards(CombinedAuthGuard)
@Controller('projects/:projectId/devices')
export class ProjectDevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get()
  findByProject(@Param('projectId') projectId: string) {
    return this.devicesService.findByProject(projectId);
  }

  @Post()
  createInProject(
      @Param('projectId') projectId: string,
      @Body() dto: CreateDeviceDto,
  ) {
    return this.devicesService.createInProject(projectId, dto);
  }

  @Get(':deviceId')
  findOne(
      @Param('projectId') projectId: string,
      @Param('deviceId') deviceId: string,
  ) {
    return this.devicesService.findOneInProject(projectId, deviceId);
  }

  @Patch(':deviceId')
  update(
      @Param('projectId') projectId: string,
      @Param('deviceId') deviceId: string,
      @Body() dto: UpdateDeviceDto,
  ) {
    return this.devicesService.updateInProject(projectId, deviceId, dto);
  }

  @Delete(':deviceId')
  remove(
      @Param('projectId') projectId: string,
      @Param('deviceId') deviceId: string,
  ) {
    return this.devicesService.removeFromProject(projectId, deviceId);
  }
}