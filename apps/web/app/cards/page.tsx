import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardsHeaderAction } from '@/components/cards-browser';
import { CardsExplorer } from '@/components/cards-explorer';
import { CardsPageLayout } from '@/components/cards-page-layout';

export const metadata: Metadata = { title: 'Cartes' };

export default function CardsPage() {
  return (
    <CardsPageLayout
      eyebrow="Catalogue"
      title="Toutes les cartes"
      description="Découvrez l’ensemble des cartes disponibles dans Safir."
      actions={<CardsHeaderAction mode="CATALOG" />}
    >
      <Suspense>
        <CardsExplorer />
      </Suspense>
    </CardsPageLayout>
  );
}
