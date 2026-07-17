import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CollectionsService } from './collections.service.js';

@Controller('api/v1/me/collection')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.collections.list(user.id);
  }
}
