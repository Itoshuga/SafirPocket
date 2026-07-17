import { Breadcrumb, PageContainer, PageHeader } from '@safir/ui';
import { DeckForm } from '@/components/deck-form';

export default function NewDeckPage() {
  return (
    <PageContainer className="max-w-3xl">
      <PageHeader
        eyebrow="Nouveau"
        title="Créer un deck"
        description="Définissez son identité. La composition sera ajoutée sur l’écran suivant."
        breadcrumbs={
          <Breadcrumb items={[{ label: 'Decks', href: '/decks' }, { label: 'Nouveau' }]} />
        }
      />
      <DeckForm />
    </PageContainer>
  );
}
