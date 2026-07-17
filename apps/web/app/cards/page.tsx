import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { CardsExplorer } from '@/components/cards-explorer';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Cartes' };

export default function CardsPage() {
  return (
    <PageContainer>
      <PageHeading eyebrow="Catalogue" title="Explorer les cartes">
        Le catalogue public ne présente que les cartes publiées.
      </PageHeading>
      <CardsExplorer />
    </PageContainer>
  );
}
