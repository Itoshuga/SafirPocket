'use client';

import type { CollectionEntry, DeckDetail, PaginatedResponse } from '@safir/shared-types';
import {
  Badge,
  Breadcrumb,
  Button,
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Panel,
  SearchInput,
  Select,
  Skeleton,
  Textarea,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { TcgCard } from './tcg-card';

export function DeckDetailView({ id }: { id: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const deck = useQuery({
    queryKey: queryKeys.deck(id),
    queryFn: () => apiFetch<DeckDetail>(`/api/v1/me/decks/${id}`),
  });
  const collection = useQuery({
    queryKey: queryKeys.collection(`deck-builder:${deferredSearch}`),
    queryFn: () =>
      apiFetch<PaginatedResponse<CollectionEntry>>(
        `/api/v1/me/collection?pageSize=100&sort=name${deferredSearch ? `&search=${encodeURIComponent(deferredSearch)}` : ''}`,
      ),
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.deck(id) }),
      client.invalidateQueries({ queryKey: queryKeys.collections }),
      client.invalidateQueries({ queryKey: queryKeys.profileRoot }),
      client.invalidateQueries({ queryKey: queryKeys.decks }),
    ]);
  };
  const setCard = useMutation({
    mutationFn: ({ cardVariantId, quantity }: { cardVariantId: string; quantity: number }) =>
      apiFetch(`/api/v1/me/decks/${id}/cards`, {
        method: 'POST',
        body: JSON.stringify({ cardVariantId, quantity }),
      }),
    onSuccess: () => void refresh(),
    onError: (error) => notify(error.message, 'error'),
  });
  const removeCard = useMutation({
    mutationFn: (cardVariantId: string) =>
      apiFetch(`/api/v1/me/decks/${id}/cards/${cardVariantId}`, { method: 'DELETE' }),
    onSuccess: () => void refresh(),
    onError: (error) => notify(error.message, 'error'),
  });
  const update = useMutation({
    mutationFn: (body: unknown) =>
      apiFetch(`/api/v1/me/decks/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      setEditOpen(false);
      notify('Deck mis à jour.', 'success');
      void refresh();
    },
    onError: (error) => notify(error.message, 'error'),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch(`/api/v1/me/decks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify('Deck supprimé.', 'success');
      router.push('/decks');
    },
    onError: (error) => notify(error.message, 'error'),
  });
  if (deck.isLoading)
    return (
      <div>
        <Skeleton className="h-28" />
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_21rem]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  if (deck.isError || !deck.data)
    return (
      <ErrorState
        title="Deck introuvable"
        message="Ce deck n’existe pas ou ne vous appartient pas."
      />
    );
  const data = deck.data;
  const quantities = new Map(data.cards.map((entry) => [entry.cardVariantId, entry.quantity]));
  const grouped = data.cards.reduce<Record<string, typeof data.cards>>((groups, entry) => {
    const type = entry.cardVariant.card.cardType;
    (groups[type] ??= []).push(entry);
    return groups;
  }, {});
  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    update.mutate({
      name: form.get('name'),
      description: form.get('description') || null,
      visibility: form.get('visibility'),
      format: form.get('format'),
    });
  }
  return (
    <>
      <Breadcrumb items={[{ label: 'Decks', href: '/decks' }, { label: data.name }]} />
      <header className="mt-5 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="primary">{data.format}</Badge>
            <Badge>{data.visibility}</Badge>
            {data.isActive ? <Badge tone="success">Actif</Badge> : null}
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{data.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {data.description ?? 'Aucune description.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="size-4" /> Modifier
          </Button>
          <Button variant="ghost" className="text-danger" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" /> Supprimer
          </Button>
        </div>
      </header>
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Panel className="p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold">{data.cardCount}</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-xs text-muted-foreground">Variantes</p>
              <p className="mt-1 text-2xl font-semibold">{data.uniqueCardCount}</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-xs text-muted-foreground">Validation</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 className="size-4" /> Cohérent
              </p>
            </Panel>
          </div>
          <Panel>
            <h2 className="text-base font-semibold">Composition</h2>
            {data.cards.length ? (
              <div className="mt-4 space-y-5">
                {Object.entries(grouped).map(([type, entries]) => (
                  <section key={type}>
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-xs font-semibold text-muted-foreground">{type}</h3>
                      <span className="text-xs text-muted-foreground">
                        {entries.reduce((sum, entry) => sum + entry.quantity, 0)}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {entries.map((entry) => (
                        <div key={entry.cardVariantId} className="flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <TcgCard
                              card={entry.cardVariant.card}
                              mode="deck"
                              variantName={entry.cardVariant.name}
                              quantity={entry.quantity}
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeCard.mutate(entry.cardVariantId)}
                            aria-label={`Retirer ${entry.cardVariant.card.name}`}
                            disabled={removeCard.isPending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                title="Deck vide"
                description="Ajoutez des cartes depuis votre collection à droite."
              />
            )}
          </Panel>
          <Panel>
            <div className="flex items-center gap-2">
              <TriangleAlert className="size-4 text-warning" />
              <h2 className="text-sm font-semibold">Résumé de validation</h2>
            </div>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {data.validation.warnings.map((warning) => (
                <li key={warning}>• {warning}</li>
              ))}
            </ul>
          </Panel>
        </div>
        <Panel className="h-fit xl:sticky xl:top-6">
          <h2 className="text-base font-semibold">Ajouter depuis la collection</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le serveur contrôle chaque quantité disponible.
          </p>
          <SearchInput
            className="mt-4"
            aria-label="Rechercher dans la collection"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onClear={() => setSearch('')}
            placeholder="Rechercher…"
          />
          {collection.isLoading ? (
            <div className="mt-4 space-y-2">
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton className="h-16" key={index} />
              ))}
            </div>
          ) : null}
          {collection.isError ? <ErrorState message="Collection indisponible." /> : null}
          <div className="mt-3 max-h-[32rem] divide-y divide-border overflow-y-auto">
            {collection.data?.data.map((entry) => {
              const current = quantities.get(entry.cardVariantId) ?? 0;
              const available = entry.quantity - entry.lockedQuantity;
              return (
                <div key={entry.cardVariantId} className="flex items-center gap-1 py-1">
                  <div className="min-w-0 flex-1">
                    <TcgCard
                      card={entry.variant.card}
                      mode="compact"
                      variantName={`${entry.variant.name} · ${available} libre${available > 1 ? 's' : ''}`}
                    />
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Ajouter ${entry.variant.card.name}`}
                    disabled={available <= 0 || setCard.isPending}
                    onClick={() =>
                      setCard.mutate({ cardVariantId: entry.cardVariantId, quantity: current + 1 })
                    }
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              );
            })}
          </div>
          {collection.data?.pagination.total && collection.data.pagination.total > 100 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Affinez la recherche pour parcourir les autres cartes.
            </p>
          ) : null}
        </Panel>
      </div>
      <Dialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Modifier le deck"
        description="Les changements sont validés par l’API."
        footer={null}
      >
        <form id="edit-deck" className="space-y-4" onSubmit={submitEdit}>
          <label className="block text-sm font-medium">
            Nom
            <Input name="name" className="mt-1.5" defaultValue={data.name} required />
          </label>
          <label className="block text-sm font-medium">
            Description
            <Textarea name="description" className="mt-1.5" defaultValue={data.description ?? ''} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Format
              <Input name="format" className="mt-1.5" defaultValue={data.format} />
            </label>
            <label className="text-sm font-medium">
              Visibilité
              <Select name="visibility" className="mt-1.5" defaultValue={data.visibility}>
                <option value="private">Privé</option>
                <option value="unlisted">Non répertorié</option>
                <option value="public">Public</option>
              </Select>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setEditOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={update.isPending} loadingLabel="Enregistrement…">
              Enregistrer
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce deck ?"
        description="Le deck sera supprimé et ses exemplaires réservés seront libérés."
        confirmLabel="Supprimer"
        danger
        loading={remove.isPending}
        onConfirm={async () => {
          await remove.mutateAsync();
        }}
      />
    </>
  );
}
