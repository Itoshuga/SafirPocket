import { Controller, Get } from '@nestjs/common';
import { Roles } from '../common/auth/roles.decorator.js';

@Roles('admin')
@Controller('api/v1/admin')
export class AdminController {
  @Get('status')
  status() {
    return { status: 'ready', message: "Fondation d'administration active." };
  }
}
