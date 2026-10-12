import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { TaskPreferencesService } from '../task-preferences/task-preferences.service';

@Module({
  imports: [SchedulerModule],
  controllers: [TasksController],
  providers: [TasksService, TaskPreferencesService, PrismaService],
})
export class TasksModule {}
