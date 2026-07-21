import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  collectionFiltersSchema,
  seasonCollectionFiltersSchema,
  slugSchema,
  usernameSchema,
} from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { OptionalAuth } from '../common/auth/optional-auth.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { CollectionsService } from './collections.service.js';

@Controller('api/v1/users')
export class PublicCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @OptionalAuth()
  @Get(':username/collection')
  list(
    @Param('username') username: string,
    @Query() query: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.collections.publicList(
      parseInput(usernameSchema, username),
      user?.id,
      parseInput(collectionFiltersSchema, query),
    );
  }

  @OptionalAuth()
  @Get(':username/collection/seasons')
  seasons(@Param('username') username: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.collections.publicSeasonSummaries(parseInput(usernameSchema, username), user?.id);
  }

  @OptionalAuth()
  @Get(':username/collection/seasons/:seasonSlug')
  season(
    @Param('username') username: string,
    @Param('seasonSlug') seasonSlug: string,
    @Query() query: unknown,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.collections.publicSeasonDetails(
      parseInput(usernameSchema, username),
      user?.id,
      parseInput(slugSchema, seasonSlug),
      parseInput(seasonCollectionFiltersSchema, query),
    );
  }
}
