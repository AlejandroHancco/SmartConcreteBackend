import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [SchedulerModule, DevicesModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, PrismaService, TasksService],
})
export class ProjectsModule {}
