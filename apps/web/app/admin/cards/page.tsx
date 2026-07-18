import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminCardsView } from '@/components/admin-cards-view';
export const metadata: Metadata = { title: 'Cartes · Administration' };
export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Cartes"
        description="Créez, filtrez, modifiez et archivez le catalogue relationnel."
      />
      <AdminCardsView />
    </PageContainer>
  );
}
