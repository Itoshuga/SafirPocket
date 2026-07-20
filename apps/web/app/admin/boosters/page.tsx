import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { AdminBoostersView } from '@/components/admin-boosters-view';

export const metadata: Metadata = { title: 'Boosters · Administration' };

export default function Page() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Boosters"
        description="Gérez les designs, disponibilités et règles de tirage de chaque saison."
      />
      <AdminBoostersView />
    </PageContainer>
  );
}
