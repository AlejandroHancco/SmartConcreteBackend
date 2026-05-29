import { Module } from '@nestjs/common';
import { TaskChannelsService } from './task-channels.service';
import { TaskChannelsController } from './task-channels.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaskChannelsController],
  providers: [TaskChannelsService],
  exports: [TaskChannelsService],
})
export class TaskChannelsModule {}

