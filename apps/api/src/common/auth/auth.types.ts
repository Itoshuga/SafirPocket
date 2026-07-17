import type { UserRole } from '@safir/shared-types';

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: UserRole;
}

declare module 'http' {
  interface IncomingMessage {
    user?: AuthenticatedUser;
  }
}
