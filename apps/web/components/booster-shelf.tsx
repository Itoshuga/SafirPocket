'use client';

import type {
  BoosterDropRate,
  BoosterProduct,
  OpenBoosterResult,
  PackOpening,
  WalletSummary,
} from '@safir/shared-types';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Panel,
  Popover,
  Skeleton,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, History, PackageOpen } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import {
  clearOtherStoredOpeningProgress,
  freshOpeningSessionKey,
  removeStoredOpeningProgress,
} from '@/lib/booster-opening';
import { profileQueryKeys, queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';
import { BoosterArtwork } from './booster-artwork';

interface OpeningAttempt {
  product: BoosterProduct;
  idempotencyKey: string;
}

export function BoosterShelf() {
  const router = useRouter();
  const client = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const notify = useAppStore((state) => state.notify);
  const [attempt, setAttempt] = useState<OpeningAttempt | null>(null);
  const products = useQuery({
    queryKey: queryKeys.boosterProducts,
    queryFn: () => apiFetch<BoosterProduct[]>('/api/v1/booster-products'),
  });
  const wallets = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: () => apiFetch<WalletSummary[]>('/api/v1/me/wallets'),
    enabled: Boolean(user),
  });
  const opening = useMutation({
    mutationFn: (current: OpeningAttempt) =>
      apiFetch<OpenBoosterResult>(`/api/v1/booster-products/${current.product.id}/open`, {
        method: 'POST',
        body: JSON.stringify({ idempotencyKey: current.idempotencyKey }),
      }),
    onSuccess: (data) => {
      setAttempt(null);
      const openingResult: PackOpening = {
        id: data.openingId,
        booster: data.booster,
        status: 'completed',
        cost: data.cost,
        openedAt: data.openedAt,
        cards: data.cards,
      };
      client.setQueryData(queryKeys.boosterOpening(data.openingId), openingResult);
      clearOtherStoredOpeningProgress(data.openingId);
      removeStoredOpeningProgress(data.openingId);
      window.sessionStorage.setItem(freshOpeningSessionKey(data.openingId), 'true');
      notify('Booster ouvert et collection mise à jour.', 'success');
      void Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.wallets }),
        client.invalidateQueries({ queryKey: queryKeys.boosterOpeningsRoot }),
        client.invalidateQueries({ queryKey: queryKeys.collections }),
        client.invalidateQueries({ queryKey: profileQueryKeys.stats.me() }),
        client.invalidateQueries({ queryKey: profileQueryKeys.seasonCollections('me') }),
      ]);
      router.push(`/boosters/open/${encodeURIComponent(data.openingId)}`);
    },
    onError: (error) => notify(error.message, 'error'),
  });

  if (products.isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-[30rem]" />
        ))}
      </div>
    );
  }
  if (products.isError) return <ErrorState message="Impossible de charger les boosters." />;
  const balanceFor = (currency: string | null) =>
    currency
      ? (wallets.data?.find((wallet) => wallet.currencyCode === currency)?.balance ?? '0')
      : '0';
  const canAfford = (product: BoosterProduct) =>
    product.cost.amount === 0 ||
    BigInt(balanceFor(product.cost.currencyCode)) >= BigInt(product.cost.amount);

  return (
    <div>
      {user ? (
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
            Les huit cartes sont tirées par le serveur. Le débit, l’historique et la collection sont
            validés ensemble.
          </p>
        </Panel>
      ) : authLoading ? (
        <Skeleton className="mb-6 h-24" />
      ) : (
        <Panel className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">Catalogue public</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connectez-vous pour ouvrir un booster et recevoir les cartes dans votre collection.
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/login?next=/boosters">Se connecter</Link>
          </Button>
        </Panel>
      )}
      {!products.data?.length ? (
        <EmptyState
          icon={<PackageOpen className="size-5" />}
          title="Aucun booster disponible"
          description="Aucun design actif n’est publié pour le moment."
        />
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.data.map((product) => (
            <Card key={product.id} className="overflow-hidden p-0">
              <BoosterArtwork
                imageUrl={product.imageUrl}
                name={product.name}
                className="aspect-[5/4] w-full border-b border-border"
              />
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Badge tone="primary">{product.season.name}</Badge>
                    <h2 className="mt-3 text-lg font-semibold">{product.name}</h2>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-primary">
                    {product.cost.amount === 0
                      ? 'Gratuit'
                      : `${product.cost.amount} ${product.cost.currencyCode}`}
                  </span>
                </div>
                <p className="mt-2 min-h-10 text-sm leading-5 text-muted-foreground">
                  {product.description ?? 'Aucune description.'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Badge>6 × {product.guaranteedCommonRarity.name}</Badge>
                  <Badge tone="primary">2 × Premium</Badge>
                </div>
                <div className="mt-5 flex items-center justify-between gap-2">
                  <Popover
                    align="start"
                    trigger={
                      <Button size="sm" variant="ghost">
                        Voir les probabilités
                      </Button>
                    }
                  >
                    <BoosterProbabilities productId={product.id} />
                  </Popover>
                  {user ? (
                    <Button
                      size="sm"
                      onClick={() => setAttempt({ product, idempotencyKey: crypto.randomUUID() })}
                      disabled={!product.isAvailable || !canAfford(product) || opening.isPending}
                    >
                      <PackageOpen className="size-4" />
                      Ouvrir
                    </Button>
                  ) : (
                    <Button asChild size="sm" disabled={!product.isAvailable || authLoading}>
                      <Link href="/login?next=/boosters">
                        <PackageOpen className="size-4" />
                        Ouvrir
                      </Link>
                    </Button>
                  )}
                </div>
                {!product.isAvailable ? (
                  <p className="mt-2 text-right text-xs text-warning">
                    Ce booster n’est pas disponible actuellement.
                  </p>
                ) : user && !canAfford(product) ? (
                  <p className="mt-2 text-right text-xs text-danger">Solde insuffisant</p>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {user ? (
        <div className="mt-7 flex justify-end">
          <Button asChild variant="outline">
            <Link href="/boosters/history">
              <History className="size-4" aria-hidden="true" />
              Historique des ouvertures
            </Link>
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(attempt)}
        onOpenChange={(open) => {
          if (!open && !opening.isPending) setAttempt(null);
        }}
        title={`Ouvrir ${attempt?.product.name ?? 'ce booster'} ?`}
        description={
          attempt
            ? attempt.product.cost.amount === 0
              ? 'Ce booster est gratuit. Les huit cartes seront ajoutées à votre collection.'
              : `${attempt.product.cost.amount} ${attempt.product.cost.currencyCode} seront débités de votre portefeuille.`
            : ''
        }
        confirmLabel={opening.isError ? 'Réessayer' : 'Confirmer l’ouverture'}
        loading={opening.isPending}
        onConfirm={() => {
          if (attempt) opening.mutate(attempt);
        }}
      />
    </div>
  );
}

function BoosterProbabilities({ productId }: { productId: string }) {
  const rates = useQuery({
    queryKey: queryKeys.boosterDropRates(productId),
    queryFn: () => apiFetch<BoosterDropRate[]>(`/api/v1/booster-products/${productId}/drop-rates`),
  });
  if (rates.isLoading) return <Skeleton className="h-24 w-56" />;
  if (rates.isError) return <p className="text-sm text-danger">Probabilités indisponibles.</p>;
  return (
    <div className="w-64">
      <h3 className="text-sm font-semibold">Deux tirages indépendants</h3>
      <div className="mt-3 space-y-2">
        {rates.data?.map((rate) => (
          <div key={rate.rarity.id} className="flex justify-between gap-4 text-sm">
            <span>{rate.rarity.name}</span>
            <span className="font-semibold">{rate.dropRateBps / 100} %</span>
          </div>
        ))}
      </div>
    </div>
  );
}
