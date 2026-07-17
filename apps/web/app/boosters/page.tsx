import type { Metadata } from 'next';
import { PageContainer, PageHeader } from '@safir/ui';
import { BoosterShelf } from '@/components/booster-shelf';

export const metadata: Metadata = { title: 'Boosters' };
export default function BoostersPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Ouverture serveur"
        title="Boosters"
        description="Choisissez un produit disponible. Le débit et l’attribution des cartes sont atomiques et autoritaires côté serveur."
      />
      <BoosterShelf />
    </PageContainer>
  );
}
