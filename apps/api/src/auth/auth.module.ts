import { Module } from '@nestjs/common';
import { AccountAccessService } from './account-access.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtVerifierService } from './jwt-verifier.service.js';

@Module({
  controllers: [AuthController],
  providers: [JwtVerifierService, AccountAccessService, AuthService],
  exports: [JwtVerifierService, AccountAccessService],
})
export class AuthModule {}
