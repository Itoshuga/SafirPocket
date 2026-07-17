import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { CollectionView } from '@/components/collection-view';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Collection' };
export default function CollectionPage() {
  return (
    <PageContainer>
      <PageHeading eyebrow="Inventaire" title="Ma collection">
        Votre inventaire est en lecture seule côté navigateur : seules les opérations serveur
        peuvent l’enrichir.
      </PageHeading>
      <CollectionView />
    </PageContainer>
  );
}
