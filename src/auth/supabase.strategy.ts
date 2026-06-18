import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { NormalizedUser } from './interfaces/auth.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy, 'supabase') {
  private supabase: SupabaseClient;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super();

    const supabaseUrl = configService.get<string>('SUPABASE_URL')!;
    const supabaseKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY')!;

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async validate(req: Request): Promise<NormalizedUser> {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException('Invalid token');
    }

    // Buscar o crear usuario en DB propia
    let dbUser = await this.prisma.user.findUnique({
      where: { email: user.email! },
    });

    if (!dbUser) {
      // Crear usuario de Google en DB
      dbUser = await this.prisma.user.create({
        data: {
          email: user.email!,
          name: user.user_metadata?.full_name?.split(' ')[0] || '',
          lastName:
            user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
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
}