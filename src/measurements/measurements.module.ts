import { Module } from '@nestjs/common';
import { MeasurementsService } from './measurements.service';
import { MeasurementsController } from './measurements.controller';
import { MeasurementsGateway } from './measurements.gateway';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [MeasurementsController],
  providers: [MeasurementsService, MeasurementsGateway, PrismaService],
  exports: [MeasurementsService, MeasurementsGateway],
})
export class MeasurementsModule {}
