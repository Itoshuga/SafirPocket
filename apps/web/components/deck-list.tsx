'use client';

import type { DeckSummary } from '@safir/shared-types';
import { Badge, Card, EmptyState, ErrorState, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Layers3, Plus } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function DeckList() {
  const query = useQuery({
    queryKey: queryKeys.decks,
    queryFn: () => apiFetch<DeckSummary[]>('/api/v1/me/decks'),
  });
  if (query.isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-48" />
        ))}
      </div>
    );
  if (query.isError) return <ErrorState message="Impossible de charger vos decks." />;
  if (!query.data?.length)
    return (
      <EmptyState
        icon={<Layers3 className="size-5" />}
        title="Aucun deck"
        description="Créez un deck puis ajoutez-y les cartes disponibles dans votre collection."
        action={
          <Link
            href="/decks/new"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            <Plus className="size-4" /> Créer votre premier deck
          </Link>
        }
      />
    );
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {query.data.map((deck) => (
        <Link href={`/decks/${deck.id}`} key={deck.id} className="group focus-visible:outline-none">
          <Card className="h-full group-hover:border-border-strong group-focus-visible:ring-2 group-focus-visible:ring-focus-ring">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">{deck.format}</Badge>
                <Badge>{deck.visibility}</Badge>
                {deck.isActive ? <Badge tone="success">Actif</Badge> : null}
              </div>
              <Layers3 className="size-5 shrink-0 text-primary" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">{deck.name}</h2>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
              {deck.description ?? 'Aucune description'}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
              <span>
                {deck.cardCount} cartes · {deck.uniqueCardCount} variantes
              </span>
              <time dateTime={deck.updatedAt}>
                {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(
                  new Date(deck.updatedAt),
                )}
              </time>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
