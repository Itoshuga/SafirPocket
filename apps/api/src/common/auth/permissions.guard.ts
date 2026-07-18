import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AppPermission } from '@safir/shared-types';
import type { AuthenticatedUser } from './auth.types.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import { hasPermission } from './permissions.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (user && required.every((permission) => hasPermission(user.role, permission))) {
      return true;
    }
    throw new ForbiddenException({
      code: 'INSUFFICIENT_PERMISSIONS',
      message: "Vous n'avez pas les permissions nécessaires pour cette action.",
    });
  }
}
