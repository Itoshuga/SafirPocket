import { Controller, Get, Query } from '@nestjs/common';
import { rankingsQuerySchema } from '@safir/validation';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Public } from '../common/auth/public.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RankingsService } from './rankings.service.js';

@Controller('api/v1')
export class RankingsController {
  constructor(private readonly rankings: RankingsService) {}

  @Public()
  @Get('rankings')
  list(@Query() query: unknown) {
    return this.rankings.leaderboard(parseInput(rankingsQuerySchema, query));
  }

  @Get('me/ranking')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.rankings.myRanking(user.id);
  }
}
