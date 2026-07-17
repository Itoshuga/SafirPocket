'use client';

import { Card, EmptyState, ErrorState, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

interface Entry {
  cardVariantId: string;
  quantity: number;
  lockedQuantity: number;
  cardVariant: { name: string; card: { name: string; rarity: string; collectionNumber: string } };
}

export function CollectionView() {
  const query = useQuery({
    queryKey: ['collection'],
    queryFn: () => apiFetch<Entry[]>('/api/v1/me/collection'),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError) return <ErrorState message="Impossible de charger votre collection." />;
  if (!query.data?.length)
    return (
      <EmptyState title="Votre écrin est vide">
        Ouvrez un booster de démonstration après avoir configuré votre portefeuille local.
      </EmptyState>
    );
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {query.data.map((entry) => (
        <Card key={entry.cardVariantId} className="p-3">
          <div className="gem-grid aspect-[5/7] rounded-xl bg-sapphire-900/30" />
          <h2 className="mt-3 font-bold">{entry.cardVariant.card.name}</h2>
          <p className="text-xs text-slate-500">{entry.cardVariant.name}</p>
          <p className="mt-2 text-sm text-sapphire-200">
            × {entry.quantity}{' '}
            <span className="text-slate-600">
              ({entry.lockedQuantity} verrouillée{entry.lockedQuantity > 1 ? 's' : ''})
            </span>
          </p>
        </Card>
      ))}
    </div>
  );
}
