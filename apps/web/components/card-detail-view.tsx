'use client';

import type { CardDetail } from '@safir/shared-types';
import { Badge, Card, ErrorState, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

export function CardDetailView({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ['card', id],
    queryFn: () => apiFetch<CardDetail>(`/api/v1/cards/${id}`),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-96 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError || !query.data)
    return <ErrorState message="Carte introuvable ou API indisponible." />;
  const card = query.data;
  return (
    <div>
      <Link href="/cards" className="text-sm text-sapphire-300 hover:text-sapphire-200">
        ← Retour au catalogue
      </Link>
      <div className="mt-6 grid gap-8 lg:grid-cols-[22rem_1fr]">
        <Card className="gem-grid aspect-[5/7] bg-gradient-to-br from-sapphire-700/60 via-purple-900/40 to-ink-950 p-4">
          <div className="grid h-full place-items-center rounded-xl border border-white/15 text-7xl text-white/30">
            ◆
          </div>
        </Card>
        <div className="py-2">
          <Badge>{card.rarity}</Badge>
          <h1 className="mt-4 text-4xl font-black">{card.name}</h1>
          <p className="mt-1 text-slate-500">
            {card.collectionNumber} · {card.cardType}
          </p>
          <p className="mt-6 max-w-2xl leading-relaxed text-slate-300">
            {card.description ?? 'Aucune description.'}
          </p>
          <Card className="mt-6">
            <h2 className="font-bold text-sapphire-200">Effet</h2>
            <p className="mt-2 text-slate-300">{card.effectText ?? 'Aucun effet publié.'}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
