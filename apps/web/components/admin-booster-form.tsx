'use client';

import type { AdminBoosterDetails, CardRarity, CardSeason } from '@safir/shared-types';
import {
  Badge,
  Button,
  ErrorState,
  Input,
  Panel,
  Select,
  Skeleton,
  Switch,
  Textarea,
} from '@safir/ui';
import { createBoosterSchema, type CreateBoosterInput } from '@safir/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ImageOff, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Dispatch, type SetStateAction, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { BoosterArtwork } from './booster-artwork';

interface BoosterFormState {
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  seasonId: string;
  guaranteedCommonRarityId: string;
  costAmount: string;
  currencyCode: string;
  availableFrom: string;
  availableUntil: string;
  sortOrder: string;
  isActive: boolean;
  rates: Record<string, string>;
}

const emptyForm: BoosterFormState = {
  name: '',
  slug: '',
  description: '',
  imageUrl: '',
  seasonId: '',
  guaranteedCommonRarityId: '',
  costAmount: '0',
  currencyCode: '',
  availableFrom: '',
  availableUntil: '',
  sortOrder: '0',
  isActive: false,
  rates: {},
};

export function AdminBoosterForm({ boosterId }: { boosterId?: string }) {
  const router = useRouter();
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [draft, setDraft] = useState<BoosterFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const booster = useQuery({
    queryKey: queryKeys.adminBooster(boosterId ?? 'new'),
    queryFn: () => apiFetch<AdminBoosterDetails>(`/api/v1/admin/boosters/${boosterId}`),
    enabled: Boolean(boosterId),
  });
  const rarities = useQuery({
    queryKey: queryKeys.adminRarities('all'),
    queryFn: () => apiFetch<CardRarity[]>('/api/v1/admin/rarities?archived=all'),
  });
  const seasons = useQuery({
    queryKey: queryKeys.adminSeasons('all'),
    queryFn: () => apiFetch<CardSeason[]>('/api/v1/admin/seasons?archived=all'),
  });

  const initialForm = useMemo(() => toFormState(booster.data), [booster.data]);
  const form = draft ?? initialForm;
  const setForm: Dispatch<SetStateAction<BoosterFormState>> = (action) => {
    setDraft((current) => {
      const value = current ?? initialForm;
      return typeof action === 'function' ? action(value) : action;
    });
  };

  const parsedRates = useMemo(
    () =>
      Object.entries(form.rates).map(([rarityId, percentage], sortOrder) => ({
        rarityId,
        percentage,
        dropRateBps: percentageToBps(percentage),
        sortOrder,
      })),
    [form.rates],
  );
  const ratesValid = parsedRates.every((rate) => rate.dropRateBps !== null && rate.dropRateBps > 0);
  const totalBps = parsedRates.reduce((total, rate) => total + (rate.dropRateBps ?? 0), 0);
  const totalValid = ratesValid && parsedRates.length > 0 && totalBps === 10_000;
  const commonInPremium = Boolean(
    form.guaranteedCommonRarityId && form.rates[form.guaranteedCommonRarityId] !== undefined,
  );
  const save = useMutation({
    mutationFn: (input: CreateBoosterInput) =>
      apiFetch<AdminBoosterDetails>(`/api/v1/admin/boosters${boosterId ? `/${boosterId}` : ''}`, {
        method: boosterId ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (saved) => {
      notify(boosterId ? 'Le booster a été mis à jour.' : 'Le booster a été créé.', 'success');
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', 'boosters'] }),
        client.invalidateQueries({ queryKey: queryKeys.boosterProducts }),
      ]);
      router.push(`/admin/boosters/${saved.id}`);
    },
    onError: (mutationError) => setError(mutationError.message),
  });

  const update = <K extends keyof BoosterFormState>(key: K, value: BoosterFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };
  const submit = () => {
    const candidate = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      imageUrl: form.imageUrl,
      seasonId: form.seasonId,
      guaranteedCommonRarityId: form.guaranteedCommonRarityId,
      costAmount: Number(form.costAmount),
      currencyCode: form.currencyCode,
      availableFrom: form.availableFrom ? new Date(form.availableFrom).toISOString() : null,
      availableUntil: form.availableUntil ? new Date(form.availableUntil).toISOString() : null,
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
      dropRates: parsedRates.map(({ rarityId, dropRateBps, sortOrder }) => ({
        rarityId,
        dropRateBps: dropRateBps ?? 0,
        sortOrder,
      })),
    };
    const parsed = createBoosterSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Vérifiez les champs du formulaire.');
      return;
    }
    setError(null);
    save.mutate(parsed.data);
  };

  if (boosterId && booster.isLoading) return <Skeleton className="h-[48rem]" />;
  if (booster.isError) return <ErrorState message="Impossible de charger ce booster." />;
  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/admin/boosters">
            <ArrowLeft className="size-4" />
            Retour
          </Link>
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!totalValid || commonInPremium}>
          <Save className="size-4" />
          Enregistrer
        </Button>
      </div>
      {error ? <ErrorState message={error} /> : null}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-6">
          <Panel>
            <h2 className="text-base font-semibold">Informations générales</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Nom">
                <Input
                  value={form.name}
                  maxLength={150}
                  onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      ...(!slugEdited && !boosterId ? { slug: slugify(name) } : {}),
                    }));
                  }}
                />
              </Field>
              <Field label="Slug">
                <Input
                  value={form.slug}
                  maxLength={160}
                  onChange={(event) => {
                    setSlugEdited(true);
                    update('slug', event.target.value);
                  }}
                />
              </Field>
            </div>
            <Field label="Description" className="mt-4">
              <Textarea
                value={form.description}
                maxLength={5000}
                onChange={(event) => update('description', event.target.value)}
              />
            </Field>
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold">Saison et rareté commune</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Saison">
                <Select
                  value={form.seasonId}
                  onChange={(event) => update('seasonId', event.target.value)}
                >
                  <option value="">Sélectionner</option>
                  {seasons.data?.map((season) => (
                    <option
                      key={season.id}
                      value={season.id}
                      disabled={Boolean(season.deletedAt) || !season.isActive}
                    >
                      {season.name}
                      {season.deletedAt ? ' · archivée' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Rareté commune garantie">
                <Select
                  value={form.guaranteedCommonRarityId}
                  onChange={(event) => {
                    const id = event.target.value;
                    setForm((current) => {
                      const rates = { ...current.rates };
                      delete rates[id];
                      return { ...current, guaranteedCommonRarityId: id, rates };
                    });
                  }}
                >
                  <option value="">Sélectionner</option>
                  {rarities.data?.map((rarity) => (
                    <option
                      key={rarity.id}
                      value={rarity.id}
                      disabled={Boolean(rarity.deletedAt) || !rarity.isActive}
                    >
                      {rarity.name}
                      {rarity.deletedAt ? ' · archivée' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Taux des deux cartes rares</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chaque position premium utilise séparément cette répartition.
                </p>
              </div>
              <Badge
                tone={
                  totalBps === 10_000 && ratesValid
                    ? 'success'
                    : totalBps > 10_000
                      ? 'danger'
                      : 'warning'
                }
              >
                Total : {(totalBps / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %
              </Badge>
            </div>
            <div className="mt-5 divide-y divide-border rounded-md border border-border">
              {rarities.data
                ?.filter((rarity) => rarity.id !== form.guaranteedCommonRarityId)
                .map((rarity) => {
                  const enabled = form.rates[rarity.id] !== undefined;
                  const unavailable = Boolean(rarity.deletedAt) || !rarity.isActive;
                  return (
                    <div
                      key={rarity.id}
                      className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_6rem_7rem] sm:items-center"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 rounded-sm border border-border"
                          style={
                            rarity.displayColor
                              ? { backgroundColor: rarity.displayColor }
                              : undefined
                          }
                        />
                        <span className="text-sm font-medium">{rarity.name}</span>
                        {unavailable ? <Badge>Inactive</Badge> : null}
                      </div>
                      <Switch
                        id={`rate-${rarity.id}`}
                        label={`Inclure ${rarity.name}`}
                        labelHidden
                        checked={enabled}
                        disabled={unavailable && !enabled}
                        onCheckedChange={(checked) =>
                          setForm((current) => {
                            const rates = { ...current.rates };
                            if (checked) rates[rarity.id] = '0';
                            else delete rates[rarity.id];
                            return { ...current, rates };
                          })
                        }
                      />
                      <div className="relative">
                        <Input
                          aria-label={`Taux de ${rarity.name}`}
                          type="number"
                          min="0.01"
                          max="100"
                          step="0.01"
                          value={enabled ? form.rates[rarity.id] : ''}
                          disabled={!enabled}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              rates: { ...current.rates, [rarity.id]: event.target.value },
                            }))
                          }
                          className="pr-8"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          %
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
            {!totalValid ? (
              <p className={`mt-3 text-sm ${totalBps > 10_000 ? 'text-danger' : 'text-warning'}`}>
                {parsedRates.length === 0
                  ? 'Activez au moins une rareté premium.'
                  : totalBps > 10_000
                    ? 'Le total dépasse 100 %.'
                    : 'Le total doit atteindre exactement 100 %.'}
              </p>
            ) : null}
          </Panel>

          <Panel>
            <h2 className="text-base font-semibold">Disponibilité et prix</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Disponible à partir du">
                <Input
                  type="datetime-local"
                  value={form.availableFrom}
                  onChange={(event) => update('availableFrom', event.target.value)}
                />
              </Field>
              <Field label="Disponible jusqu’au">
                <Input
                  type="datetime-local"
                  value={form.availableUntil}
                  onChange={(event) => update('availableUntil', event.target.value)}
                />
              </Field>
              <Field label="Coût">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={form.costAmount}
                  onChange={(event) => update('costAmount', event.target.value)}
                />
              </Field>
              <Field label="Monnaie">
                <Input
                  value={form.currencyCode}
                  maxLength={50}
                  disabled={Number(form.costAmount) === 0}
                  placeholder="gem"
                  onChange={(event) => update('currencyCode', event.target.value)}
                />
              </Field>
              <Field label="Ordre d’affichage">
                <Input
                  type="number"
                  min="-10000"
                  max="10000"
                  value={form.sortOrder}
                  onChange={(event) => update('sortOrder', event.target.value)}
                />
              </Field>
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <h2 className="text-base font-semibold">Design</h2>
            <BoosterArtwork
              imageUrl={form.imageUrl || null}
              name={form.name || 'Aperçu du booster'}
              className="mt-4 aspect-[5/7] w-full rounded-md border border-border"
            />
            <Field label="URL HTTPS" className="mt-4">
              <Input
                type="url"
                value={form.imageUrl}
                placeholder="https://…"
                onChange={(event) => update('imageUrl', event.target.value)}
              />
            </Field>
            {form.imageUrl ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => update('imageUrl', '')}
              >
                <ImageOff className="size-4" />
                Retirer le visuel
              </Button>
            ) : null}
          </Panel>
          <Panel>
            <h2 className="text-base font-semibold">Contenu du booster</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Communes</dt>
                <dd className="font-semibold">6 cartes</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Premium</dt>
                <dd className="font-semibold">2 cartes</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3">
                <dt>Total</dt>
                <dd className="font-semibold">8 cartes</dd>
              </div>
            </dl>
          </Panel>
          <Panel>
            <Switch
              id="booster-active"
              label="Booster actif"
              checked={form.isActive}
              onCheckedChange={(checked) => update('isActive', checked)}
            />
          </Panel>
          {booster.data && !booster.data.validation.valid ? (
            <Panel>
              <h2 className="text-sm font-semibold">Validation serveur</h2>
              <ul className="mt-3 space-y-2 text-sm text-danger">
                {booster.data.validation.errors.map((item, index) => (
                  <li key={`${item.code}-${index}`}>{item.message}</li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-sm font-medium ${className ?? ''}`}>
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function toFormState(booster: AdminBoosterDetails | undefined): BoosterFormState {
  if (!booster) return emptyForm;
  return {
    name: booster.name,
    slug: booster.slug,
    description: booster.description ?? '',
    imageUrl: booster.imageUrl ?? '',
    seasonId: booster.season.id,
    guaranteedCommonRarityId: booster.guaranteedCommonRarity.id,
    costAmount: String(booster.cost.amount),
    currencyCode: booster.cost.currencyCode ?? '',
    availableFrom: localDateTime(booster.availableFrom),
    availableUntil: localDateTime(booster.availableUntil),
    sortOrder: String(booster.sortOrder),
    isActive: booster.isActive,
    rates: Object.fromEntries(
      booster.dropRates.map((rate) => [rate.rarity.id, formatPercent(rate.dropRateBps)]),
    ),
  };
}

function percentageToBps(value: string): number | null {
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const number = Number(value.replace(',', '.'));
  if (!Number.isFinite(number) || number <= 0 || number > 100) return null;
  return Math.round(number * 100);
}

function formatPercent(bps: number): string {
  return (bps / 100).toFixed(bps % 100 === 0 ? 0 : 2);
}

function localDateTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 160);
}
