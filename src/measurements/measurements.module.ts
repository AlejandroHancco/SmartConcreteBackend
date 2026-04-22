import { Module } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MeasurementsController],
  providers: [MeasurementsService, PrismaService],
})
export class MeasurementsModule {}
