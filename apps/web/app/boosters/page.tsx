import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import { BoosterShelf } from '@/components/booster-shelf';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Boosters' };
export default function BoostersPage() {
  return (
    <PageContainer>
      <PageHeading eyebrow="Ouverture serveur" title="Boosters">
        Le navigateur ne reçoit ni probabilités ni choix de tirage. Le résultat apparaît après
        validation de la transaction complète.
      </PageHeading>
      <BoosterShelf />
    </PageContainer>
  );
}
