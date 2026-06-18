import { Controller, Get, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@Controller('users')
export class UsersController {
  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  getMe(@CurrentUser() user: NormalizedUser) {
    return {
      id: user.id,
      email: user.email,
      provider: user.provider,
    };
  }
}
