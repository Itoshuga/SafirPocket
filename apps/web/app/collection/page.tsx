import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { Suspense } from 'react';
import { CollectionView } from '@/components/collection-view';

export const metadata: Metadata = { title: 'Collection' };
export default function CollectionPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Inventaire"
        title="Ma collection"
        description="Consultez les exemplaires confirmés par le serveur et leur disponibilité pour vos decks."
      />
      <Suspense>
        <CollectionView />
      </Suspense>
    </PageContainer>
  );
}
