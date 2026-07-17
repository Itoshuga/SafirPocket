import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@safir/shared-types';

export const ROLES_KEY = 'safir:roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
