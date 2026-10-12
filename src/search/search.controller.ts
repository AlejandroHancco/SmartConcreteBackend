import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SearchService } from './search.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { NormalizedUser } from '../auth/interfaces/auth.interface';

@UseGuards(CombinedAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query('q') q: string, @CurrentUser() user: NormalizedUser) {
    return this.searchService.search(user.id, q ?? '');
  }
}
