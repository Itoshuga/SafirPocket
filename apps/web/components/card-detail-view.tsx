'use client';

import type { CardCollectionContext, CardDetail } from '@safir/shared-types';
import { Badge, Breadcrumb, Card, DataList, ErrorState, Panel, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { Boxes } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAuth } from './auth-provider';
import { CardImage } from './card-image';

export function CardDetailView({ id }: { id: string }) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: queryKeys.card(id),
    queryFn: () => apiFetch<CardDetail>(`/api/v1/cards/${id}`),
  });
  const context = useQuery({
    queryKey: ['card-collection-context', id],
    queryFn: () => apiFetch<CardCollectionContext>(`/api/v1/me/collection/card/${id}`),
    enabled: Boolean(user),
  });
  if (query.isLoading)
    return (
      <div className="grid gap-8 lg:grid-cols-[20rem_1fr]">
        <Skeleton className="aspect-[5/7]" />
        <div>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="mt-4 h-28" />
        </div>
      </div>
    );
  if (query.isError || !query.data)
    return (
      <ErrorState
        title="Carte introuvable"
        message="La carte n’existe pas, n’est pas publiée ou l’API est indisponible."
      />
    );
  const card = query.data;
  const statItems = Object.entries(card.stats ?? {});
  return (
    <div>
      <Breadcrumb items={[{ label: 'Cartes', href: '/cards' }, { label: card.name }]} />
      <div className="mt-6 grid gap-8 lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div>
          <CardImage
            artworkPath={card.artworkPath}
            alt={`Illustration de ${card.name}`}
            priority
            className="w-full shadow-card"
          />
          {user ? (
            <Card className="mt-4 p-4">
              <div className="flex items-center gap-2">
                <Boxes className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">Dans ma collection</h2>
              </div>
              {context.isLoading ? (
                <Skeleton className="mt-3 h-8" />
              ) : (
                <p className="mt-3 text-2xl font-semibold">{context.data?.totalQuantity ?? 0}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                {context.data?.lockedQuantity ?? 0} exemplaire(s) réservé(s) dans des decks.
              </p>
              {context.data?.decks.length ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Utilisée dans</p>
                  <div className="mt-1 divide-y divide-border">
                    {context.data.decks.map((deck) => (
                      <Link
                        key={`${deck.id}-${deck.variantName}`}
                        href={`/decks/${deck.id}`}
                        className="flex items-center justify-between py-2 text-xs font-medium hover:text-primary"
                      >
                        <span>{deck.name}</span>
                        <span>× {deck.quantity}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{card.rarity}</Badge>
            <Badge>{card.cardType}</Badge>
            {card.set ? <Badge>{card.set.name}</Badge> : null}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{card.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {card.set?.code ? `${card.set.code} · ` : ''}
            {card.collectionNumber}
            {card.cost !== null ? ` · Coût ${card.cost}` : ''}
          </p>
          <p className="mt-6 max-w-3xl leading-7 text-muted-foreground">
            {card.description ?? 'Aucune description publiée.'}
          </p>
          <Panel className="mt-6">
            <h2 className="text-sm font-semibold">Effet</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {card.effectText ?? 'Aucun effet publié.'}
            </p>
          </Panel>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Panel>
              <h2 className="text-sm font-semibold">Informations</h2>
              <DataList
                className="mt-3"
                items={[
                  { label: 'Extension', value: card.set?.name ?? '—' },
                  { label: 'Numéro', value: card.collectionNumber },
                  { label: 'Rareté', value: card.rarity },
                  { label: 'Type', value: card.cardType },
                ]}
              />
            </Panel>
            <Panel>
              <h2 className="text-sm font-semibold">Caractéristiques</h2>
              {statItems.length ? (
                <DataList
                  className="mt-3"
                  items={statItems.map(([label, value]) => ({
                    label,
                    value:
                      typeof value === 'string' || typeof value === 'number'
                        ? String(value)
                        : JSON.stringify(value),
                  }))}
                />
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Aucune caractéristique chiffrée.
                </p>
              )}
            </Panel>
          </div>
          <Panel className="mt-5">
            <h2 className="text-sm font-semibold">Variantes</h2>
            {card.variants.length ? (
              <div className="mt-3 divide-y divide-border">
                {card.variants.map((variant) => (
                  <div key={variant.id} className="flex items-center justify-between py-3 text-sm">
                    <span className="font-medium">{variant.name}</span>
                    <Badge>{variant.finish}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Aucune variante publiée.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
