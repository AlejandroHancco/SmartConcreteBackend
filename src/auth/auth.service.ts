import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (user && user.password && (await bcrypt.compare(password, user.password))) {
      const { password: _pw, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { name: user.name, sub: user.uuid };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(email: string, name: string, lastName: string | undefined, password: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        lastName,
        password: hashedPassword,
      },
    });
    return this.login(user);
  }

  async getProfile(uuid: string) {
    if (!uuid) {
      throw new UnauthorizedException('UUID no proporcionado');
    }

    const user = await this.prisma.user.findUnique({
      where: { uuid },
      select: {
        uuid: true,
        email: true,
        name: true,
        lastName: true,
        provider: true,
        emailVerified: true,
        banned: true,
        rejectionCount: true,
        createdAt: true,
        teamMembers: {
          include: { team: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const membership = user.teamMembers[0] ?? null;
    const teamStatus: string = membership ? (membership.status as string) : 'PENDING_TEAM';

    const { teamMembers, ...rest } = user;
    return {
      ...rest,
      teamStatus,
      team: membership
        ? { id: membership.team.id, name: membership.team.name, code: membership.team.code }
        : null,
    };
  }
  async checkEmail(email: string): Promise<{
    exists: boolean;
    provider: 'password' | 'google' | null;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        email: true,
        password: true,
      },
    });

    if (!user) return { exists: false, provider: null };

    // En Supabase, si el usuario no tiene password, es porque usó un provider externo
    if (!user.password || user.password === '') return { exists: true, provider: 'google' };

    return { exists: true, provider: 'password' };
  }
}
