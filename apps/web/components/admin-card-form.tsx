'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminCard, CardRarity, CardSeason, CardType } from '@safir/shared-types';
import {
  Button,
  Checkbox,
  ErrorState,
  Input,
  Panel,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '@safir/ui';
import {
  createCardSchema,
  type CreateCardFormInput,
  type CreateCardInput,
} from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { apiFetch } from '@/lib/api-client';
import { applyApiFieldErrors } from '@/lib/admin-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { CardImage } from './card-image';

export function AdminCardForm({ cardId }: { cardId?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const card = useQuery({
    queryKey: queryKeys.adminCard(cardId ?? 'new'),
    queryFn: () => apiFetch<AdminCard>(`/api/v1/admin/cards/${cardId}`),
    enabled: Boolean(cardId),
  });
  const rarities = useQuery({
    queryKey: queryKeys.adminRarities('all'),
    queryFn: () => apiFetch<CardRarity[]>('/api/v1/admin/rarities?archived=all'),
  });
  const seasons = useQuery({
    queryKey: queryKeys.adminSeasons('all'),
    queryFn: () => apiFetch<CardSeason[]>('/api/v1/admin/seasons?archived=all'),
  });
  const types = useQuery({
    queryKey: queryKeys.adminCardTypes('all'),
    queryFn: () => apiFetch<CardType[]>('/api/v1/admin/card-types?archived=all'),
  });
  const form = useForm<CreateCardFormInput, unknown, CreateCardInput>({
    resolver: zodResolver(createCardSchema),
    defaultValues: {
      name: '',
      number: 0,
      attack: 0,
      defense: 0,
      value: 0,
      description: null,
      imageUrl: null,
      isCommander: false,
      rarityId: '',
      seasonId: '',
      typeIds: [],
      isActive: true,
    },
  });

  useEffect(() => {
    if (!card.data) return;
    form.reset({
      name: card.data.name,
      number: card.data.number,
      attack: card.data.attack,
      defense: card.data.defense,
      value: card.data.value,
      description: card.data.description,
      imageUrl: card.data.imageUrl,
      isCommander: card.data.isCommander,
      rarityId: card.data.rarity.id,
      seasonId: card.data.season.id,
      typeIds: card.data.types.map((type) => type.id),
      isActive: card.data.isActive,
    });
  }, [card.data, form]);

  const save = useMutation({
    mutationFn: (input: CreateCardInput) =>
      apiFetch<AdminCard>(`/api/v1/admin/cards${cardId ? `/${cardId}` : ''}`, {
        method: cardId ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (saved) => {
      notify(
        cardId ? 'Les modifications ont été enregistrées.' : 'La carte a été créée.',
        'success',
      );
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'cards'] }),
        client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
        client.invalidateQueries({ queryKey: queryKeys.cardFacets }),
      ]);
      router.push(`/admin/cards/${saved.id}`);
    },
    onError: (error) => applyApiFieldErrors(error, form.setError),
  });
  const selectedTypes = useWatch({ control: form.control, name: 'typeIds' });
  const imageUrl = useWatch({ control: form.control, name: 'imageUrl' });
  const isCommander = useWatch({ control: form.control, name: 'isCommander' });
  const isActive = useWatch({ control: form.control, name: 'isActive' });
  if (cardId && card.isLoading) return <Skeleton className="h-[42rem]" />;
  if (card.isError) return <ErrorState message="Impossible de charger cette carte." />;
  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      noValidate
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/admin/cards">
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </Button>
        <Button type="submit" loading={save.isPending}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      </div>
      {form.formState.errors.root?.message ? (
        <ErrorState message={form.formState.errors.root.message} />
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-base font-semibold">Identité de la carte</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <label className="block text-sm font-medium">
                Nom
                <Input
                  className="mt-1.5"
                  aria-invalid={Boolean(form.formState.errors.name)}
                  {...form.register('name')}
                />
              </label>
              <label className="block text-sm font-medium">
                Numéro
                <Input
                  type="number"
                  min={0}
                  className="mt-1.5"
                  aria-invalid={Boolean(form.formState.errors.number)}
                  {...form.register('number', { valueAsNumber: true })}
                />
              </label>
            </div>
            <label className="mt-4 block text-sm font-medium">
              Description
              <Textarea
                className="mt-1.5"
                maxLength={5000}
                {...form.register('description', { setValueAs: (value) => value || null })}
              />
            </label>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Valeurs de jeu</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium">
                Attaque
                <Input
                  type="number"
                  min={0}
                  className="mt-1.5"
                  {...form.register('attack', { valueAsNumber: true })}
                />
              </label>
              <label className="block text-sm font-medium">
                Défense
                <Input
                  type="number"
                  min={0}
                  className="mt-1.5"
                  {...form.register('defense', { valueAsNumber: true })}
                />
              </label>
              <label className="block text-sm font-medium">
                Valeur
                <Input
                  type="number"
                  min={0}
                  className="mt-1.5"
                  {...form.register('value', { valueAsNumber: true })}
                />
              </label>
            </div>
            <div className="mt-5">
              <Switch
                id="is-commander"
                label="Carte commandant"
                checked={isCommander}
                onCheckedChange={(value) =>
                  form.setValue('isCommander', value, { shouldDirty: true })
                }
              />
            </div>
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Classement du catalogue</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Rareté
                <Select
                  className="mt-1.5"
                  aria-invalid={Boolean(form.formState.errors.rarityId)}
                  {...form.register('rarityId')}
                >
                  <option value="">Sélectionner</option>
                  {rarities.data?.map((item) => (
                    <option key={item.id} value={item.id} disabled={Boolean(item.deletedAt)}>
                      {item.name}
                      {item.deletedAt ? ' · archivée' : ''}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm font-medium">
                Saison
                <Select
                  className="mt-1.5"
                  aria-invalid={Boolean(form.formState.errors.seasonId)}
                  {...form.register('seasonId')}
                >
                  <option value="">Sélectionner</option>
                  {seasons.data?.map((item) => (
                    <option key={item.id} value={item.id} disabled={Boolean(item.deletedAt)}>
                      {item.name}
                      {item.deletedAt ? ' · archivée' : ''}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
            <fieldset className="mt-5">
              <legend className="text-sm font-medium">Types</legend>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {types.data?.map((item) => (
                  <Checkbox
                    key={item.id}
                    id={`type-${item.id}`}
                    label={item.name}
                    description={item.deletedAt ? 'Archivé' : undefined}
                    disabled={Boolean(item.deletedAt) && !selectedTypes.includes(item.id)}
                    checked={selectedTypes.includes(item.id)}
                    onCheckedChange={(checked) =>
                      form.setValue(
                        'typeIds',
                        checked
                          ? [...selectedTypes, item.id]
                          : selectedTypes.filter((id) => id !== item.id),
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  />
                ))}
              </div>
              {form.formState.errors.typeIds?.message ? (
                <p className="mt-2 text-xs text-danger">{form.formState.errors.typeIds.message}</p>
              ) : null}
            </fieldset>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel>
            <h2 className="text-base font-semibold">Illustration</h2>
            <div className="mt-4">
              <CardImage artworkPath={imageUrl ?? null} alt="Aperçu de la carte" />
            </div>
            <label className="mt-4 block text-sm font-medium">
              URL HTTPS
              <Input
                type="url"
                className="mt-1.5"
                placeholder="https://…"
                aria-invalid={Boolean(form.formState.errors.imageUrl)}
                {...form.register('imageUrl', { setValueAs: (value) => value || null })}
              />
            </label>
            {form.formState.errors.imageUrl?.message ? (
              <p className="mt-2 text-xs text-danger">{form.formState.errors.imageUrl.message}</p>
            ) : null}
          </Panel>
          <Panel>
            <Switch
              id="is-active"
              label="Carte active"
              checked={isActive}
              onCheckedChange={(value) => form.setValue('isActive', value, { shouldDirty: true })}
            />
          </Panel>
        </div>
      </div>
    </form>
  );
}
