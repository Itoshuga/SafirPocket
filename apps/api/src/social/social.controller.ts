import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { friendActionSchema, idSchema, usernameSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { SocialService } from './social.service.js';

@Controller('api/v1')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('me/friends')
  friends(@CurrentUser() user: AuthenticatedUser) {
    return this.social.friends(user.id);
  }

  @Get('me/friend-requests')
  received(@CurrentUser() user: AuthenticatedUser) {
    return this.social.received(user.id);
  }

  @Get('me/friend-requests/sent')
  sent(@CurrentUser() user: AuthenticatedUser) {
    return this.social.sent(user.id);
  }

  @Post('users/by-username/:username/friend-request')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  requestByUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Param('username') username: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.requestByUsername(user.id, parseInput(usernameSchema, username));
  }

  @Post('users/by-username/:username/friend-request/accept')
  acceptByUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Param('username') username: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.acceptByUsername(user.id, parseInput(usernameSchema, username));
  }

  @Delete('users/by-username/:username/friendship')
  removeFriendByUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Param('username') username: string,
  ) {
    return this.social.removeFriendByUsername(user.id, parseInput(usernameSchema, username));
  }

  @Post('users/by-username/:username/block')
  blockByUsername(
    @CurrentUser() user: AuthenticatedUser,
    @Param('username') username: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.blockByUsername(user.id, parseInput(usernameSchema, username));
  }

  @Delete('users/by-username/:username/block')
  unblockByUsername(@CurrentUser() user: AuthenticatedUser, @Param('username') username: string) {
    return this.social.unblockByUsername(user.id, parseInput(usernameSchema, username));
  }

  @Post('users/:userId/friend-request')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  request(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.request(user.id, parseInput(idSchema, targetUserId));
  }

  @Post('me/friend-requests/:requestId/accept')
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.accept(user.id, parseInput(idSchema, requestId));
  }

  @Post('me/friend-requests/:requestId/decline')
  decline(
    @CurrentUser() user: AuthenticatedUser,
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.decline(user.id, parseInput(idSchema, requestId));
  }

  @Delete('me/friend-requests/:requestId')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('requestId') requestId: string) {
    return this.social.cancel(user.id, parseInput(idSchema, requestId));
  }

  @Delete('me/friends/:userId')
  removeFriend(@CurrentUser() user: AuthenticatedUser, @Param('userId') friendId: string) {
    return this.social.removeFriend(user.id, parseInput(idSchema, friendId));
  }

  @Get('me/blocked-users')
  blocked(@CurrentUser() user: AuthenticatedUser) {
    return this.social.blocked(user.id);
  }

  @Post('users/:userId/block')
  block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') targetUserId: string,
    @Body() body: unknown,
  ) {
    parseInput(friendActionSchema, body ?? {});
    return this.social.block(user.id, parseInput(idSchema, targetUserId));
  }

  @Delete('users/:userId/block')
  unblock(@CurrentUser() user: AuthenticatedUser, @Param('userId') targetUserId: string) {
    return this.social.unblock(user.id, parseInput(idSchema, targetUserId));
  }
}
