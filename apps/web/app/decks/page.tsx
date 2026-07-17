import type { Metadata } from 'next';
import { Button, PageContainer, PageHeader } from '@safir/ui';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { DeckList } from '@/components/deck-list';

export const metadata: Metadata = { title: 'Decks' };
export default function DecksPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Construction"
        title="Mes decks"
        description="Créez et maintenez des listes composées uniquement de cartes disponibles dans votre collection."
        actions={
          <Button asChild>
            <Link href="/decks/new">
              <Plus className="size-4" /> Nouveau deck
            </Link>
          </Button>
        }
      />
      <DeckList />
    </PageContainer>
  );
}
