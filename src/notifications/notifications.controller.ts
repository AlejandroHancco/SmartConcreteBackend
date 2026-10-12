import { Controller, Get, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@Controller('notifications')
@UseGuards(CombinedAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findMine(@CurrentUser() user: NormalizedUser) {
    return this.notificationsService.findForUser(user.id);
  }

  @Get('unread-count')
  countUnread(@CurrentUser() user: NormalizedUser) {
    return this.notificationsService.countUnread(user.id);
  }

  @Patch('read-all')
  markAllAsRead(@CurrentUser() user: NormalizedUser) {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: NormalizedUser,
  ) {
    return this.notificationsService.markAsRead(id, user.id);
  }
}
