import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminCardForm } from '@/components/admin-card-form';
export const metadata: Metadata = { title: 'Nouvelle carte · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Nouvelle carte"
        description="Renseignez les valeurs puis associez les référentiels du catalogue."
      />
      <AdminCardForm />
    </PageContainer>
  );
}
