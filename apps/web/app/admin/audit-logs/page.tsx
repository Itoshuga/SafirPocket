import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminAuditLogsView } from '@/components/admin-audit-logs-view';
export const metadata: Metadata = { title: 'Journaux · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Journaux"
        description="Consultez la piste d’audit immuable des opérations sensibles."
      />
      <AdminAuditLogsView />
    </PageContainer>
  );
}
