import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DeviceHealthService } from './device-health.service';
import { DevicesController, ProjectDevicesController } from './devices.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [DevicesController, ProjectDevicesController],
  providers: [DevicesService, DeviceHealthService, PrismaService],
  exports: [DevicesService],
})
export class DevicesModule {}
