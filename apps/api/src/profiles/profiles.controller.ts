import { Body, Controller, Delete, Get, Patch } from '@nestjs/common';
import { profileUpdateSchema, updateProfileBannerSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { AllowDeactivated } from '../common/auth/allow-deactivated.decorator.js';
import { ProfilesService } from './profiles.service.js';
import { ProfileStatsService } from './profile-stats.service.js';

@Controller('api/v1/me/profile')
export class ProfilesController {
  constructor(
    private readonly profiles: ProfilesService,
    private readonly profileStats: ProfileStatsService,
  ) {}

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
    return this.profileStats.get(user.id);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.profiles.updateMe(user.id, parseInput(profileUpdateSchema, body));
  }

  @Patch('banner')
  updateBanner(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.profiles.updateBanner(user.id, parseInput(updateProfileBannerSchema, body));
  }

  @Delete('banner')
  removeBanner(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.removeBanner(user.id);
  }
}
