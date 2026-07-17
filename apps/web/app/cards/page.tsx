import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { Suspense } from 'react';
import { CardsExplorer } from '@/components/cards-explorer';

export const metadata: Metadata = { title: 'Cartes' };

export default function CardsPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Catalogue"
        title="Explorer les cartes"
        description="Recherchez les cartes publiées et affinez les résultats avec les filtres serveur."
      />
      <Suspense>
        <CardsExplorer />
      </Suspense>
    </PageContainer>
  );
}
