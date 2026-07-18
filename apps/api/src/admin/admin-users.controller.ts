import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  adminUserEmailUpdateSchema,
  adminUserProfileUpdateSchema,
  adminUsersQuerySchema,
  banSchema,
  idSchema,
  moderationSchema,
  passwordResetEmailSchema,
  roleChangeSchema,
  temporaryPasswordSchema,
  warningCreateSchema,
  warningHistoryQuerySchema,
  warningRevokeSchema,
} from '@safir/validation';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RequestId } from '../common/logging/request-id.decorator.js';
import { AdminUsersService } from './admin-users.service.js';

@Permissions('USERS_READ')
@Controller('api/v1/admin/users')
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.users.list(parseInput(adminUsersQuerySchema, query));
  }

  @Permissions('USERS_VIEW_MODERATION_HISTORY')
  @Get(':userId/moderation-history')
  history(@Param('userId') userId: string) {
    return this.users.history(parseInput(idSchema, userId));
  }

  @Permissions('USERS_VIEW_MODERATION_HISTORY')
  @Get(':userId/audit-logs')
  auditLogs(@Param('userId') userId: string) {
    return this.users.auditLogs(parseInput(idSchema, userId));
  }

  @Permissions('USERS_VIEW_MODERATION_HISTORY')
  @Get(':userId/warnings')
  warnings(@Param('userId') userId: string, @Query() query: unknown) {
    return this.users.warnings(
      parseInput(idSchema, userId),
      parseInput(warningHistoryQuerySchema, query),
    );
  }

  @Permissions('USERS_UPDATE_PROFILE')
  @Patch(':userId/profile')
  updateProfile(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.updateProfile(
      actor,
      parseInput(idSchema, userId),
      parseInput(adminUserProfileUpdateSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_UPDATE_EMAIL')
  @Patch(':userId/email')
  updateEmail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.updateEmail(
      actor,
      parseInput(idSchema, userId),
      parseInput(adminUserEmailUpdateSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_SEND_PASSWORD_RESET')
  @Post(':userId/password-reset-email')
  passwordResetEmail(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    parseInput(passwordResetEmailSchema, body);
    return this.users.sendPasswordReset(actor, parseInput(idSchema, userId), requestId);
  }

  @Permissions('USERS_SET_TEMPORARY_PASSWORD')
  @Post(':userId/temporary-password')
  temporaryPassword(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.setTemporaryPassword(
      actor,
      parseInput(idSchema, userId),
      parseInput(temporaryPasswordSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_WARN')
  @Post(':userId/warnings')
  createWarning(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.createWarning(
      actor,
      parseInput(idSchema, userId),
      parseInput(warningCreateSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_WARN')
  @Post(':userId/warnings/:warningId/revoke')
  revokeWarning(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Param('warningId') warningId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.revokeWarning(
      actor,
      parseInput(idSchema, userId),
      parseInput(idSchema, warningId),
      parseInput(warningRevokeSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_SUSPEND')
  @Post(':userId/suspend')
  suspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.suspend(
      actor,
      parseInput(idSchema, userId),
      parseInput(moderationSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_SUSPEND')
  @Post(':userId/unsuspend')
  unsuspend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.unsuspend(
      actor,
      parseInput(idSchema, userId),
      parseInput(moderationSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_BAN')
  @Post(':userId/ban')
  ban(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.ban(
      actor,
      parseInput(idSchema, userId),
      parseInput(banSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_BAN')
  @Post(':userId/unban')
  unban(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.unban(
      actor,
      parseInput(idSchema, userId),
      parseInput(moderationSchema, body),
      requestId,
    );
  }

  @Permissions('USERS_CHANGE_ROLE')
  @Patch(':userId/role')
  changeRole(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.users.changeRole(
      actor,
      parseInput(idSchema, userId),
      parseInput(roleChangeSchema, body),
      requestId,
    );
  }

  @Get(':userId')
  details(@Param('userId') userId: string) {
    return this.users.details(parseInput(idSchema, userId));
  }
}
