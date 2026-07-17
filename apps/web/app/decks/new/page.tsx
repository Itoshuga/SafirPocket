import { PageContainer } from '@safir/ui';
import { DeckForm } from '@/components/deck-form';
import { PageHeading } from '@/components/page-heading';

export default function NewDeckPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeading eyebrow="Nouveau" title="Créer un deck">
        Commencez par son identité; vous ajouterez ensuite les cartes possédées.
      </PageHeading>
      <DeckForm />
    </PageContainer>
  );
}
