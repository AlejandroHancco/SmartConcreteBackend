import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { NormalizedUser } from './interfaces/auth.interface';
import { PrismaService } from '../prisma/prisma.service';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  user_metadata?: { full_name?: string };
  [key: string]: any;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  private readonly logger = new Logger(SupabaseStrategy.name);
  private supabase: SupabaseClient;
  private readonly jwtSecret?: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super();

    const supabaseUrl = configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;

    this.supabase = createClient(supabaseUrl, supabaseKey);

    // Supabase → Settings → API → JWT Secret. Si está configurado, la
    // verificación es local (sin round-trip a Supabase en cada request).
    this.jwtSecret = configService.get<string>('SUPABASE_JWT_SECRET');
    if (!this.jwtSecret) {
      this.logger.warn(
        'SUPABASE_JWT_SECRET no configurado — usando verificación remota (más lenta)',
      );
    }
  }

  async validate(req: Request): Promise<NormalizedUser> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const payload = await this.verifyToken(token);

    if (!payload?.email) {
      throw new UnauthorizedException('Invalid token');
    }

    // Buscar o crear usuario en DB propia
    let dbUser = await this.prisma.user.findUnique({
      where: { email: payload.email },
    });

    if (!dbUser) {
      // Crear usuario de Google en DB
      dbUser = await this.prisma.user.create({
        data: {
          email: payload.email,
          name: payload.user_metadata?.full_name?.split(' ')[0] || '',
          lastName:
            payload.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
          password: '', // No password for Google users
          provider: 'google',
          emailVerified: true, // Google ya verificó el email
          banned: false,
          rejectionCount: 0,
        },
      });
    }

    // Verificar si está baneado
    if (dbUser.banned) {
      throw new UnauthorizedException('Tu cuenta ha sido suspendida');
    }

    return {
      id: dbUser.uuid,
      email: dbUser.email,
      role: undefined,
      provider: 'supabase',
    };
  }

  /**
   * Verificación del token:
   * 1. Local con SUPABASE_JWT_SECRET (rápida, sin red).
   * 2. Fallback remoto (supabase.auth.getUser) si no hay secret
   *    o si la verificación local falla (p.ej. proyecto con claves asimétricas).
   */
  private async verifyToken(token: string): Promise<SupabaseJwtPayload> {
    if (this.jwtSecret) {
      try {
        return jwt.verify(token, this.jwtSecret) as SupabaseJwtPayload;
      } catch (err) {
        this.logger.debug(
          `Verificación local falló (${err.message}) — intentando verificación remota`,
        );
      }
    }

    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      sub: user.id,
      email: user.email,
      user_metadata: user.user_metadata as { full_name?: string },
    };
  }
}
