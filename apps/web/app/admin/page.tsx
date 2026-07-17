import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminOverview } from '@/components/admin-overview';

export const metadata: Metadata = { title: 'Administration' };

export default function AdminPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Accès restreint"
        title="Administration"
        description="Supervisez les données publiées et l’activité technique accessibles à votre rôle."
      />
      <AdminOverview />
    </PageContainer>
  );
}
