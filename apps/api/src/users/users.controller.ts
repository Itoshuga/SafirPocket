import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { userSearchQuerySchema, usernameSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { OptionalAuth } from '../common/auth/optional-auth.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { UsersService } from './users.service.js';

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  search(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown) {
    return this.users.search(user.id, parseInput(userSearchQuerySchema, query));
  }

  @OptionalAuth()
  @Get(':username/public-profile')
  publicProfile(@Param('username') username: string, @CurrentUser() user?: AuthenticatedUser) {
    return this.users.publicProfile(parseInput(usernameSchema, username), user?.id);
  }
}
