import { Controller, Get } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { EconomyService } from './economy.service.js';

@Controller('api/v1/me/wallets')
export class EconomyController {
  constructor(private readonly economy: EconomyService) {}

  @Get()
  wallets(@CurrentUser() user: AuthenticatedUser) {
    return this.economy.wallets(user.id);
  }
}
