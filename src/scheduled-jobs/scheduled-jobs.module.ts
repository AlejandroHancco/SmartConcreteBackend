import { Module } from '@nestjs/common';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { ScheduledJobsController } from './scheduled-jobs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduledJobsController],
  providers: [ScheduledJobsService],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
