import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { boosterOpenSchema, idSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { BoostersService } from './boosters.service.js';

@Controller('api/v1/booster-products')
export class BoostersController {
  constructor(private readonly boosters: BoostersService) {}

  @Get()
  list() {
    return this.boosters.listProducts();
  }

  @Post(':id/open')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  open(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    const { idempotencyKey } = parseInput(boosterOpenSchema, body);
    return this.boosters.openPack(user.id, parseInput(idSchema, id), idempotencyKey);
  }
}
