'use client';

import type { DeckSummary } from '@safir/shared-types';
import { Badge, Card, EmptyState, ErrorState, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

export function DeckList() {
  const query = useQuery({
    queryKey: ['decks'],
    queryFn: () =>
      apiFetch<Array<DeckSummary & { _count?: { cards: number } }>>('/api/v1/me/decks'),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError) return <ErrorState message="Impossible de charger vos decks." />;
  if (!query.data?.length)
    return (
      <EmptyState title="Aucun deck">
        <Link href="/decks/new" className="text-sapphire-300">
          Créer votre premier deck
        </Link>
      </EmptyState>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {query.data.map((deck) => (
        <Link href={`/decks/${deck.id}`} key={deck.id}>
          <Card className="h-full transition hover:-translate-y-1 hover:border-sapphire-300/30">
            <div className="flex items-start justify-between">
              <div>
                <Badge>{deck.format}</Badge>
                <h2 className="mt-3 text-xl font-bold">{deck.name}</h2>
              </div>
              <span className="text-3xl text-sapphire-300">▤</span>
            </div>
            <p className="mt-2 line-clamp-2 text-sm text-slate-400">
              {deck.description ?? 'Aucune description'}
            </p>
            <p className="mt-5 text-xs font-semibold text-slate-500">
              {deck._count?.cards ?? 0} variantes · {deck.visibility}
            </p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
