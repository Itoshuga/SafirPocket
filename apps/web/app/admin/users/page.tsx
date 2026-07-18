import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminUsersView } from '@/components/admin-users-view';

export const metadata: Metadata = { title: 'Utilisateurs · Administration' };

export default function AdminUsersPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs"
        description="Recherchez les comptes, consultez leur historique et appliquez les actions autorisées."
      />
      <AdminUsersView />
    </PageContainer>
  );
}
