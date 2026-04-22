import { Module } from '@nestjs/common';
import { TaskPreferencesService } from './task-preferences.service';
import { TaskPreferencesController } from './task-preferences.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TaskPreferencesController],
  providers: [TaskPreferencesService, PrismaService],
})
export class TaskPreferencesModule {}
