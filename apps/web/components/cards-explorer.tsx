'use client';

import type { CardSummary, PaginatedResponse } from '@safir/shared-types';
import { Badge, Card, EmptyState, ErrorState, Input, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export function CardsExplorer() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['cards', deferredSearch],
    queryFn: () =>
      apiFetch<PaginatedResponse<CardSummary>>(
        `/api/v1/cards?search=${encodeURIComponent(deferredSearch)}&pageSize=48`,
      ),
  });
  return (
    <div>
      <div className="mb-6 rounded-2xl border border-white/10 bg-ink-900/60 p-4">
        <label className="text-sm font-semibold" htmlFor="card-search">
          Rechercher
        </label>
        <Input
          id="card-search"
          className="mt-2"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Nom ou texte d’effet…"
        />
      </div>
      {query.isLoading ? (
        <div className="grid min-h-64 place-items-center text-sapphire-300">
          <Spinner />
        </div>
      ) : null}
      {query.isError ? (
        <ErrorState message="Le catalogue est momentanément indisponible. Vérifiez que l’API locale est démarrée." />
      ) : null}
      {query.data && !query.data.data.length ? (
        <EmptyState title="Aucune carte trouvée">
          Modifiez votre recherche ou ajoutez des données de démonstration.
        </EmptyState>
      ) : null}
      {query.data?.data.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {query.data.data.map((card) => (
            <Link key={card.id} href={`/cards/${card.id}`} className="group">
              <Card className="h-full p-2 transition group-hover:-translate-y-1 group-hover:border-sapphire-300/30">
                <div className="gem-grid aspect-[5/7] overflow-hidden rounded-xl bg-gradient-to-br from-sapphire-700/60 via-purple-900/50 to-ink-950 p-3">
                  <div className="grid h-full place-items-center rounded-lg border border-white/10">
                    <span className="text-4xl text-white/40">◆</span>
                  </div>
                </div>
                <div className="px-1 pb-1 pt-3">
                  <Badge>{card.rarity}</Badge>
                  <h2 className="mt-2 truncate font-bold">{card.name}</h2>
                  <p className="text-xs text-slate-500">
                    {card.collectionNumber} · {card.cardType}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
