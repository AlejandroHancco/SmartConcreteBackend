import { Controller, Get, Inject, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Endpoint público de health check (sin guards).
 * GET /health
 */
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private redis: Redis | null,
  ) {}

  @Get()
  async check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: await this.checkDatabase(),
        redis: await this.checkRedis(),
      },
    };
  }

  private async checkDatabase(): Promise<string> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  private async checkRedis(): Promise<string> {
    if (!this.redis) return 'not_configured';
    try {
      await this.redis.ping();
      return 'ok';
    } catch {
      return 'error';
    }
  }
}
