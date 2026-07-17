'use client';

import { Button, Card, EmptyState, ErrorState, Spinner } from '@safir/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';

interface Product {
  id: string;
  name: string;
  description: string | null;
  priceCurrency: string;
  priceAmount: string;
  cardsPerPack: number;
}
interface Opening {
  id: string;
  cards: unknown[];
}

export function BoosterShelf() {
  const notify = useAppStore((state) => state.notify);
  const query = useQuery({
    queryKey: ['booster-products'],
    queryFn: () => apiFetch<Product[]>('/api/v1/booster-products'),
  });
  const opening = useMutation({
    mutationFn: (productId: string) =>
      apiFetch<Opening>(`/api/v1/booster-products/${productId}/open`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: (data) =>
      notify(`${data.cards.length} carte(s) ajoutée(s) à votre collection.`, 'success'),
    onError: (error) => notify(error.message, 'error'),
  });
  if (query.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (query.isError) return <ErrorState message="Impossible de charger les boosters." />;
  if (!query.data?.length)
    return (
      <EmptyState title="Aucun booster disponible">
        Le serveur retournera une erreur métier tant qu’aucun produit n’est publié.
      </EmptyState>
    );
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {query.data.map((product) => (
        <Card key={product.id} className="overflow-hidden p-0">
          <div className="gem-grid grid aspect-[16/10] place-items-center bg-gradient-to-br from-sapphire-600/50 via-purple-900/50 to-ink-950">
            <span className="text-7xl text-white/30">◇</span>
          </div>
          <div className="p-5">
            <h2 className="text-xl font-bold">{product.name}</h2>
            <p className="mt-2 min-h-10 text-sm text-slate-400">{product.description}</p>
            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm font-bold text-sapphire-200">
                {product.priceAmount} {product.priceCurrency}
              </span>
              <Button onClick={() => opening.mutate(product.id)} disabled={opening.isPending}>
                Ouvrir · {product.cardsPerPack}
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
