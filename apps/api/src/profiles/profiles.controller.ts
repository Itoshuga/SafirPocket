import { Body, Controller, Get, Patch } from '@nestjs/common';
import { profileUpdateSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { AllowDeactivated } from '../common/auth/allow-deactivated.decorator.js';
import { ProfilesService } from './profiles.service.js';

@Controller('api/v1/me/profile')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @AllowDeactivated()
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getMe(user.id);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.summary(user.id);
  }

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.summary(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.profiles.updateMe(user.id, parseInput(profileUpdateSchema, body));
  }
}
