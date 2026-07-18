import type { AccountStatus, AppRole } from '@safir/shared-types';

export interface VerifiedAuthUser {
  id: string;
  email: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  username: string;
  role: AppRole;
  status: AccountStatus;
  suspendedUntil: Date | null;
}

declare module 'http' {
  interface IncomingMessage {
    user?: AuthenticatedUser;
  }
}
