import { SetMetadata } from '@nestjs/common';

export const OPTIONAL_AUTH_KEY = 'safir:optional-auth';
export const OptionalAuth = () => SetMetadata(OPTIONAL_AUTH_KEY, true);
