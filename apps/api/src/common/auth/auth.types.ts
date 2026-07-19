import type { AccountStatus, AppRole } from '@safir/shared-types';

export interface VerifiedAuthUser {
  id: string;
  email: string | null;
  issuedAt?: number | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string | null;
  username: string;
  role: AppRole;
  status: AccountStatus;
  suspendedUntil: Date | null;
  isDeactivated?: boolean;
  accessToken?: string;
  issuedAt?: number | null;
}

declare module 'http' {
  interface IncomingMessage {
    user?: AuthenticatedUser;
  }
}
