import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { QueueModule } from '../queue/queue.module';
import { isQueueEnabled } from '../queue/queue.constants';
import { MeasurementsModule } from '../measurements/measurements.module';
import { SchedulerService } from './scheduler.service';
import { MeasurementSchedulingService } from './scheduling.service';
import { SchedulerController } from './scheduler.controller';
import { MeasurementProcessor } from './measurement.processor';

/**
 * Módulo central de orquestación de mediciones:
 * - SchedulerService: cron que despacha ScheduledJobs (cada minuto)
 * - MeasurementSchedulingService: control de admisión de mediciones manuales
 *   (estimación aditiva por rangos × canales, límite de backlog,
 *   conflicto con mediciones programadas)
 * - MeasurementProcessor: worker de la cola Bull (solo con REDIS_URL)
 */
@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    MeasurementsModule,
  ],
  controllers: [SchedulerController],
  providers: [
    SchedulerService,
    MeasurementSchedulingService,
    // El processor solo se registra si la cola Bull está habilitada (REDIS_URL)
    ...(isQueueEnabled() ? [MeasurementProcessor] : []),
  ],
  exports: [MeasurementSchedulingService],
})
export class SchedulerModule {}
