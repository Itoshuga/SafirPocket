import type { Metadata } from 'next';
import { PageContainer } from '@safir/ui';
import Link from 'next/link';
import { DeckList } from '@/components/deck-list';
import { PageHeading } from '@/components/page-heading';

export const metadata: Metadata = { title: 'Decks' };
export default function DecksPage() {
  return (
    <PageContainer>
      <PageHeading
        eyebrow="Construction"
        title="Mes decks"
        action={
          <Link
            href="/decks/new"
            className="rounded-xl bg-sapphire-500 px-5 py-3 text-sm font-bold shadow-lg shadow-sapphire-900/30"
          >
            Nouveau deck
          </Link>
        }
      >
        Les limites officielles seront activées lorsqu’elles seront connues.
      </PageHeading>
      <DeckList />
    </PageContainer>
  );
}
