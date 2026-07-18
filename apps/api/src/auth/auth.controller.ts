import { Controller, Get, Query } from '@nestjs/common';
import { usernameAvailabilityQuerySchema } from '@safir/validation';
import { Public } from '../common/auth/public.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { AuthService } from './auth.service.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('username-availability')
  usernameAvailability(@Query() query: unknown) {
    const { username } = parseInput(usernameAvailabilityQuerySchema, query);
    return this.auth.usernameAvailability(username);
  }
}
