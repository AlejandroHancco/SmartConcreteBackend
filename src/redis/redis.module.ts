import { Global, Module, Logger, Provider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/**
 * Cliente ioredis compartido (caché de permisos, health check).
 * Si REDIS_URL no está configurado, provee null y los consumidores
 * hacen fallback (caché en memoria / health 'not_configured').
 */
const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (): Redis | null => {
    const url = process.env.REDIS_URL;
    if (!url) {
      Logger.warn('REDIS_URL no configurado — caché de permisos en memoria', 'RedisModule');
      return null;
    }

    const client = new Redis(url, {
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false, // fallar rápido si Redis está caído (los consumidores degradan)
    });

    client.on('error', (err) => {
      Logger.warn(`Redis connection error: ${err.message}`, 'RedisModule');
    });

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule {}
