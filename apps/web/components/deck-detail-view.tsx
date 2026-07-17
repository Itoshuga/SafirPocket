'use client';

import { Badge, Card, EmptyState, ErrorState, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { PageHeading } from './page-heading';

interface DeckDetail {
  id: string;
  name: string;
  description: string | null;
  format: string;
  visibility: string;
  cards: Array<{
    quantity: number;
    cardVariant: { id: string; name: string; card: { name: string } };
  }>;
}

export function DeckDetailView({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['deck', id],
    queryFn: () => apiFetch<DeckDetail>(`/api/v1/me/decks/${id}`),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError || !query.data) return <ErrorState message="Deck introuvable." />;
  const deck = query.data;
  return (
    <>
      <Link href="/decks" className="text-sm text-sapphire-300">
        ← Mes decks
      </Link>
      <div className="mt-5">
        <PageHeading eyebrow={deck.format} title={deck.name}>
          <Badge>{deck.visibility}</Badge> <span className="ml-2">{deck.description}</span>
        </PageHeading>
      </div>
      {deck.cards.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deck.cards.map((entry) => (
            <Card key={entry.cardVariant.id}>
              <p className="font-bold">{entry.cardVariant.card.name}</p>
              <p className="text-sm text-slate-500">
                {entry.cardVariant.name} · × {entry.quantity}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Deck vide">
          L’ajout de cartes se fait via l’API sécurisée et vérifie votre collection.
        </EmptyState>
      )}
    </>
  );
}
