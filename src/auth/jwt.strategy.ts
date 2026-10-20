import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedUser } from './interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<NormalizedUser> {
    const user = await this.prisma.user.findUnique({
      where: { uuid: payload.sub },
    });
    
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // payload.iat está en segundos; un token emitido en el mismo segundo del
    // cambio de contraseña se acepta (no hay forma de distinguirlo del nuevo token).
    if (
      user.passwordChangedAt &&
      payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)
    ) {
      throw new UnauthorizedException('La sesión fue cerrada por un cambio de contraseña');
    }

    return {
      id: user.uuid,
      email: user.email,
      provider: 'jwt',
    } satisfies NormalizedUser;
  }
}
