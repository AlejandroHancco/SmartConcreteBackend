import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from './prisma.service';

@Injectable()
export class RlsMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const userId = (req as any).user?.uuid; // Asumiendo que el JWT pone el user en req.user
    if (userId) {
      await this.prisma.$executeRawUnsafe(`SET app.current_user_id = '${userId}'`);
    }
    next();
  }
}
