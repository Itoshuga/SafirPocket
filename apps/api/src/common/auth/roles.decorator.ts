import { SetMetadata } from '@nestjs/common';
import type { AppRole } from '@safir/shared-types';

export const ROLES_KEY = 'safir:roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
