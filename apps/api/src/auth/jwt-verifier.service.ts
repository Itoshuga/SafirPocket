import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { UserRole } from '@safir/shared-types';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';

@Injectable()
export class JwtVerifierService {
  private readonly issuer: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL').replace(/\/$/, '');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async verify(token: string): Promise<AuthenticatedUser> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
      });
      return this.toUser(payload);
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: "Le jeton d'accès est invalide ou expiré.",
      });
    }
  }

  private toUser(payload: JWTPayload): AuthenticatedUser {
    if (!payload.sub) {
      throw new UnauthorizedException({
        code: 'INVALID_ACCESS_TOKEN',
        message: 'Jeton sans sujet.',
      });
    }
    const metadata = payload.app_metadata;
    const candidate =
      metadata && typeof metadata === 'object' && 'role' in metadata
        ? metadata.role
        : payload.user_role;
    const role: UserRole = candidate === 'admin' || candidate === 'moderator' ? candidate : 'user';
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
      role,
    };
  }
}
