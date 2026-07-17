'use client';

import type { BoosterOpening, BoosterProductSummary, WalletSummary } from '@safir/shared-types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Panel,
  Popover,
  Skeleton,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, History, PackageOpen } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { TcgCard } from './tcg-card';

export function BoosterShelf() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [selected, setSelected] = useState<BoosterProductSummary | null>(null);
  const [result, setResult] = useState<BoosterOpening | null>(null);
  const products = useQuery({
    queryKey: queryKeys.boosterProducts,
    queryFn: () => apiFetch<BoosterProductSummary[]>('/api/v1/booster-products'),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => apiFetch<WalletSummary[]>('/api/v1/me/wallets'),
  });
  const history = useQuery({
    queryKey: queryKeys.boosterOpenings,
    queryFn: () => apiFetch<BoosterOpening[]>('/api/v1/me/booster-openings'),
  });
  const opening = useMutation({
    mutationFn: (productId: string) =>
      apiFetch<BoosterOpening>(`/api/v1/booster-products/${productId}/open`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID() }),
      }),
    onSuccess: (data) => {
      setSelected(null);
      setResult(data);
      notify('Booster ouvert et collection mise à jour.', 'success');
      void Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.wallets }),
        client.invalidateQueries({ queryKey: queryKeys.boosterOpenings }),
        client.invalidateQueries({ queryKey: ['collection'] }),
        client.invalidateQueries({ queryKey: queryKeys.collectionSummary }),
      ]);
    },
    onError: (error) => notify(error.message, 'error'),
  });
  if (products.isLoading)
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-80" />
        ))}
      </div>
    );
  if (products.isError) return <ErrorState message="Impossible de charger les boosters." />;
  const balanceFor = (currency: string) =>
    wallets.data?.find((wallet) => wallet.currencyCode === currency)?.balance ?? '0';
  return (
    <div>
      <Panel className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
            <Coins className="size-5" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">Soldes disponibles</p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm font-semibold">
              {wallets.isLoading ? (
                <Skeleton className="h-5 w-28" />
              ) : wallets.data?.length ? (
                wallets.data.map((wallet) => (
                  <span key={wallet.currencyCode}>
                    {wallet.balance} {wallet.currencyCode}
                  </span>
                ))
              ) : (
                <span>Aucun portefeuille</span>
              )}
            </div>
          </div>
        </div>
        <p className="max-w-lg text-xs leading-5 text-muted-foreground">
          Le prix est débité et les cartes sont attribuées dans une seule transaction serveur. Les
          probabilités ne sont pas exposées au navigateur.
        </p>
      </Panel>
      {!products.data?.length ? (
        <EmptyState
          icon={<PackageOpen className="size-5" />}
          title="Aucun booster disponible"
          description="Aucun produit publié n’est disponible pour le moment."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.data.map((product) => (
            <Card key={product.id} className="overflow-hidden p-0">
              <div className="grid aspect-[16/8] place-items-center border-b border-border bg-surface-muted">
                <PackageOpen className="size-12 text-primary" aria-hidden="true" />
              </div>
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="primary">{product.cardsPerPack} cartes</Badge>
                    <h2 className="mt-3 text-lg font-semibold">{product.name}</h2>
                  </div>
                  <span className="text-sm font-semibold text-primary">
                    {product.priceAmount} {product.priceCurrency}
                  </span>
                </div>
                <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                  {product.description ?? 'Aucune description.'}
                </p>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <Popover
                    align="start"
                    trigger={
                      <Button size="sm" variant="ghost">
                        Contenu possible
                      </Button>
                    }
                  >
                    <h3 className="text-sm font-semibold">Cartes possibles</h3>
                    <div className="mt-3 max-h-72 divide-y divide-border overflow-y-auto">
                      {product.possibleCards.length ? (
                        product.possibleCards.map((item) => (
                          <TcgCard
                            key={item.variantId}
                            card={item.card}
                            mode="compact"
                            variantName={item.variantName}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucun aperçu publié.</p>
                      )}
                    </div>
                  </Popover>
                  <Button
                    size="sm"
                    onClick={() => setSelected(product)}
                    disabled={
                      BigInt(balanceFor(product.priceCurrency)) < BigInt(product.priceAmount)
                    }
                  >
                    Ouvrir
                  </Button>
                </div>
                {BigInt(balanceFor(product.priceCurrency)) < BigInt(product.priceAmount) ? (
                  <p className="mt-2 text-right text-xs text-danger">Solde insuffisant</p>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
      <section className="mt-9">
        <div className="mb-4 flex items-center gap-2">
          <History className="size-4 text-primary" />
          <h2 className="text-base font-semibold">Ouvertures récentes</h2>
        </div>
        {history.isLoading ? (
          <Skeleton className="h-24" />
        ) : history.data?.length ? (
          <div className="divide-y divide-border rounded-lg border border-border bg-surface">
            {history.data.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setResult(item)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
              >
                <div>
                  <p className="text-sm font-semibold">{item.product.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.cards.reduce((sum, card) => sum + card.quantity, 0)} cartes ·{' '}
                    {item.openedAt
                      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                          new Date(item.openedAt),
                        )
                      : 'En cours'}
                  </p>
                </div>
                <Badge tone="success">Terminée</Badge>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune ouverture enregistrée.</p>
        )}
      </section>
      <ConfirmDialog
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelected(null)}
        title={`Ouvrir ${selected?.name ?? 'ce booster'} ?`}
        description={
          selected
            ? `${selected.priceAmount} ${selected.priceCurrency} seront débités de votre portefeuille.`
            : ''
        }
        confirmLabel="Confirmer l’ouverture"
        loading={opening.isPending}
        onConfirm={async () => {
          if (selected) await opening.mutateAsync(selected.id);
        }}
      />
      <Dialog
        open={Boolean(result)}
        onOpenChange={(open) => !open && setResult(null)}
        title="Résultat de l’ouverture"
        description="Ces cartes ont été attribuées par le serveur."
      >
        <div className="space-y-2">
          {result?.cards.map((item) => (
            <div
              key={item.variant.id}
              className="animate-in fade-in zoom-in-95 motion-reduce:animate-none"
            >
              <TcgCard
                card={item.variant.card}
                mode="compact"
                variantName={item.variant.name}
                quantity={item.quantity}
              />
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
