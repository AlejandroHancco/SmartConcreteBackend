import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { PrismaService } from '../prisma/prisma.service';
import { MeasurementsModule } from '../measurements/measurements.module';
import { TaskPreferencesService } from '../task-preferences/task-preferences.service';

@Module({
  imports: [MeasurementsModule],
  controllers: [TasksController],
  providers: [TasksService, TaskPreferencesService, PrismaService],
})
export class TasksModule {}
