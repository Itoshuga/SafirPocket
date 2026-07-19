import { Body, Controller, Get, Patch } from '@nestjs/common';
import { userPreferencesUpdateSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { PreferencesService } from './preferences.service.js';

@Controller('api/v1/me/preferences')
export class PreferencesController {
  constructor(private readonly preferences: PreferencesService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.preferences.get(user.id);
  }

  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.preferences.update(user.id, parseInput(userPreferencesUpdateSchema, body));
  }
}
