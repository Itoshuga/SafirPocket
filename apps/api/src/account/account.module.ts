import { Module } from '@nestjs/common';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { SupabaseAccountAuthService } from './supabase-account-auth.service.js';

@Module({
  controllers: [AccountController],
  providers: [AccountService, SupabaseAccountAuthService],
  exports: [AccountService],
})
export class AccountModule {}
