import { Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service.js';

@Module({ providers: [JwtVerifierService], exports: [JwtVerifierService] })
export class AuthModule {}
