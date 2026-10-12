import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { MEASUREMENTS_QUEUE, isQueueEnabled } from './queue.constants';

/**
 * Configura Bull con Redis (REDIS_URL desde env, ej. Upstash: rediss://...).
 * Si REDIS_URL no está configurado, el módulo queda vacío y los services
 * hacen fallback a ejecución directa (@Optional @InjectQueue → undefined).
 */
@Module({
  imports: isQueueEnabled()
    ? [
        BullModule.forRoot({
          url: process.env.REDIS_URL,
        }),
        BullModule.registerQueue({ name: MEASUREMENTS_QUEUE }),
      ]
    : [],
  exports: isQueueEnabled() ? [BullModule] : [],
})
export class QueueModule {}
