import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from 'jose';
import type { VerifiedAuthUser } from '../common/auth/auth.types.js';

@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<VerifiedAuthUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      return this.toUser(payload);
    } catch (error) {
      throw new UnauthorizedException({
        code: error instanceof errors.JWTExpired ? 'SESSION_EXPIRED' : 'UNAUTHORIZED',
        message:
          error instanceof errors.JWTExpired
            ? 'Votre session a expiré. Reconnectez-vous.'
            : "Le jeton d'accès est invalide.",
      });
    }
  }

  private toUser(payload: JWTPayload): VerifiedAuthUser {
    if (!payload.sub) {
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Jeton sans sujet.',
      });
    }
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  }
}
