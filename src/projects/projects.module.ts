import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import {MeasurementsModule} from "../measurements/measurements.module";
import {DevicesModule} from "../devices/devices.module";


@Module({
  imports: [MeasurementsModule, DevicesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService, TasksService],
})
export class ProjectsModule {}
