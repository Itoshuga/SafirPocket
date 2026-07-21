import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CardsHeaderAction } from '@/components/cards-browser';
import { CardsPageLayout } from '@/components/cards-page-layout';
import { CollectionView } from '@/components/collection-view';

export const metadata: Metadata = { title: 'Collection' };
export default function CollectionPage() {
  return (
    <CardsPageLayout
      eyebrow="Inventaire"
      title="Ma collection"
      description="Consultez les exemplaires confirmés par le serveur et leur disponibilité pour vos decks."
      actions={<CardsHeaderAction mode="COLLECTION" />}
    >
      <Suspense>
        <CollectionView />
      </Suspense>
    </CardsPageLayout>
  );
}
