import {
  CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../common/auth/public.decorator.js';
import { OPTIONAL_AUTH_KEY } from '../common/auth/optional-auth.decorator.js';
import { ALLOW_DEACTIVATED_KEY } from '../common/auth/allow-deactivated.decorator.js';
import { AccountAccessService } from './account-access.service.js';
import { JwtVerifierService } from './jwt-verifier.service.js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: JwtVerifierService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const optional = this.reflector.getAllAndOverride<boolean>(OPTIONAL_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowDeactivated = this.reflector.getAllAndOverride<boolean>(ALLOW_DEACTIVATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      if (optional) return true;
      throw new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Authentification requise.',
      });
    }
    const accessToken = authorization.slice(7);
    const identity = await this.verifier.verify(accessToken);
    request.user = await this.accountAccess.authenticate(identity, accessToken, {
      allowDeactivated,
    });
    return true;
  }
}
