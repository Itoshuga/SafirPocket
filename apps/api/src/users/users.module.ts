import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { ProfilesModule } from '../profiles/profiles.module.js';
import { ProfileAccessPolicyService } from './profile-access-policy.service.js';

@Module({
  imports: [ProfilesModule],
  controllers: [UsersController],
  providers: [UsersService, ProfileAccessPolicyService],
  exports: [ProfileAccessPolicyService],
})
export class UsersModule {}
