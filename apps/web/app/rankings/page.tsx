import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { Suspense } from 'react';
import { RankingsView } from '@/components/rankings-view';

export const metadata: Metadata = { title: 'Classement' };

export default function RankingsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Compétition"
        title="Classement"
        description="Consultez les positions calculées à partir de la saison enregistrée par le serveur."
      />
      <Suspense>
        <RankingsView />
      </Suspense>
    </PageContainer>
  );
}
