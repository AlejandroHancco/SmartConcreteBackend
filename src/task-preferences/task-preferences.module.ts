import { Module } from '@nestjs/common';
import { TaskPreferencesService } from './task-preferences.service';
import { TaskPreferencesController } from './task-preferences.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaskPreferencesController],
  providers: [TaskPreferencesService],
})
export class TaskPreferencesModule {}
