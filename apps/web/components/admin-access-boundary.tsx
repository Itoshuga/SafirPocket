'use client';

import { ErrorState, PageContainer, Skeleton } from '@safir/ui';
import type { ReactNode } from 'react';
import { canAccessAdministration } from '@/lib/navigation';
import { useAuth } from './auth-provider';

export function AdminAccessBoundary({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) {
    return (
      <PageContainer>
        <Skeleton className="h-[32rem]" />
      </PageContainer>
    );
  }
  if (!user || !profile || !canAccessAdministration(profile.role)) {
    return (
      <PageContainer>
        <ErrorState
          title="Accès interdit"
          message="Cette section est réservée aux modérateurs et administrateurs. Aucune donnée administrative n’a été chargée."
        />
      </PageContainer>
    );
  }
  return children;
}
