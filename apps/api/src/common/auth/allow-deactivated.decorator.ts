import { SetMetadata } from '@nestjs/common';

export const ALLOW_DEACTIVATED_KEY = 'safir:allow-deactivated';
export const AllowDeactivated = () => SetMetadata(ALLOW_DEACTIVATED_KEY, true);
