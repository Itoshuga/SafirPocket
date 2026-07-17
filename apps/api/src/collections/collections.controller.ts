import { Controller, Get, Param, Query } from '@nestjs/common';
import { collectionFiltersSchema, idSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { CollectionsService } from './collections.service.js';

@Controller('api/v1/me/collection')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.collections.list(user.id, parseInput(collectionFiltersSchema, query));
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.collections.summary(user.id);
  }

  @Get('card/:cardId')
  cardContext(@CurrentUser() user: AuthenticatedUser, @Param('cardId') cardId: string) {
    return this.collections.cardContext(user.id, parseInput(idSchema, cardId));
  }
}
