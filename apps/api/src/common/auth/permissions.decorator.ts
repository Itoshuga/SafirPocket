import { SetMetadata } from '@nestjs/common';
import type { AppPermission } from '@safir/shared-types';

export const PERMISSIONS_KEY = 'safir:permissions';
export const Permissions = (...permissions: AppPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
