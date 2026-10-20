import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy.validate', () => {
  const configService = { get: () => 'test-secret' };
  const prisma = { user: { findUnique: jest.fn() } };
  const strategy = new JwtStrategy(configService as any, prisma as any);

  beforeEach(() => jest.clearAllMocks());

  it('rechaza un token emitido antes del cambio de contraseña', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    prisma.user.findUnique.mockResolvedValue({
      uuid: 'u',
      email: 'a@a.com',
      passwordChangedAt: changedAt,
    });
    const iat = Math.floor(changedAt.getTime() / 1000) - 1;
    await expect(strategy.validate({ sub: 'u', iat })).rejects.toThrow(UnauthorizedException);
  });

  it('acepta un token emitido en o después del cambio de contraseña', async () => {
    const changedAt = new Date('2026-01-01T00:00:10.000Z');
    prisma.user.findUnique.mockResolvedValue({
      uuid: 'u',
      email: 'a@a.com',
      passwordChangedAt: changedAt,
    });
    const iat = Math.floor(changedAt.getTime() / 1000);
    await expect(strategy.validate({ sub: 'u', iat })).resolves.toEqual({
      id: 'u',
      email: 'a@a.com',
      provider: 'jwt',
    });
  });

  it('acepta cualquier token cuando passwordChangedAt es null', async () => {
    prisma.user.findUnique.mockResolvedValue({
      uuid: 'u',
      email: 'a@a.com',
      passwordChangedAt: null,
    });
    await expect(strategy.validate({ sub: 'u', iat: 0 })).resolves.toEqual({
      id: 'u',
      email: 'a@a.com',
      provider: 'jwt',
    });
  });
});
