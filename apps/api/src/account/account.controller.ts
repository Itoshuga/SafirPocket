import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  accountDeactivateSchema,
  accountDeletionCancelSchema,
  accountDeletionRequestSchema,
  accountEmailUpdateSchema,
  accountPasswordUpdateSchema,
  accountReactivateSchema,
  accountReauthenticationSchema,
  accountSessionsRevokeSchema,
} from '@safir/validation';
import { AllowDeactivated } from '../common/auth/allow-deactivated.decorator.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { AccountService } from './account.service.js';

@Controller('api/v1/me/account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @AllowDeactivated()
  @Get('security-settings')
  settings(@CurrentUser() user: AuthenticatedUser) {
    return this.account.securitySettings(user.id);
  }

  @Post('reauthenticate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reauthenticate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    parseInput(accountReauthenticationSchema, body ?? {});
    return this.account.reauthenticate(user);
  }

  @Patch('email')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  email(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.updateEmail(user, parseInput(accountEmailUpdateSchema, body));
  }

  @Patch('password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  password(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.updatePassword(user, parseInput(accountPasswordUpdateSchema, body));
  }

  @Post('sessions/revoke')
  revoke(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    parseInput(accountSessionsRevokeSchema, body);
    return this.account.revokeSessions(user);
  }

  @Post('deactivate')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  deactivate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.deactivate(user, parseInput(accountDeactivateSchema, body));
  }

  @AllowDeactivated()
  @Post('reactivate')
  reactivate(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.reactivate(user, parseInput(accountReactivateSchema, body));
  }

  @Post('deletion-request')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  deletionRequest(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.requestDeletion(user, parseInput(accountDeletionRequestSchema, body));
  }

  @AllowDeactivated()
  @Post('deletion-cancel')
  deletionCancel(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.account.cancelDeletion(user, parseInput(accountDeletionCancelSchema, body));
  }
}
