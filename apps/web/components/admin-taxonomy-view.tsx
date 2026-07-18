'use client';

import {
  hasPermission,
  type CardRarity,
  type CardSeason,
  type CardType,
} from '@safir/shared-types';
import { createCardTypeSchema, createRaritySchema, createSeasonSchema } from '@safir/validation';
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  Input,
  MobileList,
  SearchInput,
  Skeleton,
  Switch,
  Table,
  Textarea,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { mutationErrorMessage, mutationFieldErrors, zodFieldErrors } from '@/lib/admin-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import { useAuth } from './auth-provider';

type TaxonomyItem = CardRarity | CardSeason | CardType;
type Kind = 'rarities' | 'seasons' | 'types';
type DestructiveAction = 'archive' | 'restore' | 'delete';

interface TaxonomyFormState {
  name: string;
  slug: string;
  description: string;
  displayColor: string;
  sortOrder: string;
  isActive: boolean;
  code: string;
  startDate: string;
  endDate: string;
}

const config = {
  rarities: {
    endpoint: 'rarities',
    singular: 'rareté',
    title: 'Raretés',
    created: 'La rareté a été créée.',
  },
  seasons: {
    endpoint: 'seasons',
    singular: 'saison',
    title: 'Saisons',
    created: 'La saison a été créée.',
  },
  types: {
    endpoint: 'card-types',
    singular: 'type',
    title: 'Types',
    created: 'Le type a été créé.',
  },
} as const;

function emptyForm(): TaxonomyFormState {
  return {
    name: '',
    slug: '',
    description: '',
    displayColor: '',
    sortOrder: '0',
    isActive: true,
    code: '',
    startDate: '',
    endDate: '',
  };
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function parseForm(kind: Kind, form: TaxonomyFormState) {
  const common = {
    name: form.name,
    slug: form.slug,
    description: form.description,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
  };
  if (kind === 'seasons') {
    return createSeasonSchema.safeParse({
      ...common,
      code: form.code,
      startDate: form.startDate,
      endDate: form.endDate,
    });
  }
  const payload = { ...common, displayColor: form.displayColor };
  return kind === 'rarities'
    ? createRaritySchema.safeParse(payload)
    : createCardTypeSchema.safeParse(payload);
}

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1 text-xs text-danger">{message}</p> : null;
}

export function AdminTaxonomyView({ kind }: { kind: Kind }) {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const { role } = useAuth();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [editing, setEditing] = useState<TaxonomyItem | 'new' | null>(null);
  const [form, setForm] = useState<TaxonomyFormState>(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    item: TaxonomyItem;
    action: DestructiveAction;
  } | null>(null);
  const settings = config[kind];
  const params = new URLSearchParams({ archived: 'all' });
  if (deferredSearch) params.set('search', deferredSearch);
  const filters = params.toString();
  const key =
    kind === 'rarities'
      ? queryKeys.adminRarities(filters)
      : kind === 'seasons'
        ? queryKeys.adminSeasons(filters)
        : queryKeys.adminCardTypes(filters);
  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetch<TaxonomyItem[]>(`/api/v1/admin/${settings.endpoint}?${filters}`),
  });

  const save = useMutation({
    mutationFn: ({ id, payload }: { id?: string; payload: Record<string, unknown> }) =>
      apiFetch<TaxonomyItem>(`/api/v1/admin/${settings.endpoint}${id ? `/${id}` : ''}`, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (_item, variables) => {
      notify(
        variables.id ? 'Les modifications ont été enregistrées.' : settings.created,
        'success',
      );
      setEditing(null);
      setForm(emptyForm());
      setFieldErrors({});
      setFormError(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', kind === 'types' ? 'card-types' : kind] }),
        client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
        client.invalidateQueries({ queryKey: queryKeys.cardFacets }),
      ]);
    },
    onError: (error) => {
      setFieldErrors(mutationFieldErrors(error));
      setFormError(mutationErrorMessage(error));
      notify(mutationErrorMessage(error), 'error');
    },
  });

  const destructive = useMutation({
    mutationFn: async ({ item, action }: NonNullable<typeof pendingAction>) =>
      apiFetch(
        `/api/v1/admin/${settings.endpoint}/${item.id}${action === 'restore' ? '/restore' : action === 'delete' ? '/permanent' : ''}`,
        { method: action === 'restore' ? 'POST' : 'DELETE' },
      ),
    onSuccess: async () => {
      notify('Action appliquée et journalisée.', 'success');
      setPendingAction(null);
      await Promise.all([
        client.invalidateQueries({ queryKey: ['admin', kind === 'types' ? 'card-types' : kind] }),
        client.invalidateQueries({ queryKey: queryKeys.adminOverview }),
        client.invalidateQueries({ queryKey: queryKeys.cardFacets }),
      ]);
    },
    onError: (error) => notify(mutationErrorMessage(error), 'error'),
  });

  function setField<K extends keyof TaxonomyFormState>(field: K, value: TaxonomyFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: [] }));
    setFormError(null);
  }

  function open(item: TaxonomyItem | 'new') {
    setEditing(item);
    setFieldErrors({});
    setFormError(null);
    setSlugTouched(item !== 'new');
    if (item === 'new') {
      setForm(emptyForm());
      return;
    }
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description ?? '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
      displayColor: 'displayColor' in item ? (item.displayColor ?? '') : '',
      code: 'code' in item ? (item.code ?? '') : '',
      startDate: 'code' in item ? (item.startDate ?? '') : '',
      endDate: 'code' in item ? (item.endDate ?? '') : '',
    });
  }

  function submit() {
    setFieldErrors({});
    setFormError(null);
    const parsed = parseForm(kind, form);
    if (!parsed.success) {
      const errors = zodFieldErrors(parsed.error);
      setFieldErrors(errors);
      setFormError('Vérifiez les champs signalés.');
      return;
    }
    const item = editing === 'new' ? null : editing;
    save.mutate({ id: item?.id, payload: parsed.data as Record<string, unknown> });
  }

  const rows = query.data ?? [];
  const canCreate = hasPermission(role, 'CATALOG_CREATE');
  const canUpdate = hasPermission(role, 'CATALOG_UPDATE');
  const canArchive = hasPermission(role, 'CATALOG_ARCHIVE');
  const canRestore = hasPermission(role, 'CATALOG_RESTORE');
  const canDelete = hasPermission(role, 'CATALOG_DELETE_PERMANENTLY');

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch('')}
          placeholder={`Rechercher une ${settings.singular}`}
          aria-label={`Rechercher une ${settings.singular}`}
          className="sm:w-80"
        />
        {canCreate ? (
          <Button onClick={() => open('new')}>
            <Plus className="size-4" />
            Ajouter
          </Button>
        ) : null}
      </div>

      {query.isLoading ? <Skeleton className="mt-5 h-80" /> : null}
      {query.isError ? (
        <div className="mt-5">
          <ErrorState
            message={`Impossible de charger les ${settings.title.toLowerCase()}.`}
            action={<Button onClick={() => void query.refetch()}>Réessayer</Button>}
          />
        </div>
      ) : null}
      {!query.isLoading && !query.isError && rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState title={`Aucune ${settings.singular}`} />
        </div>
      ) : null}

      {rows.length ? (
        <>
          <div className="mt-5 hidden md:block">
            <Table caption={settings.title}>
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Cartes</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.slug}</td>
                    <td className="px-4 py-3">{item.cardCount ?? 0}</td>
                    <td className="px-4 py-3">
                      <Badge tone={item.deletedAt ? 'warning' : 'success'}>
                        {item.deletedAt ? 'Archivée' : 'Active'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canUpdate ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Modifier ${item.name}`}
                            title="Modifier"
                            onClick={() => open(item)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        ) : null}
                        {item.deletedAt && canRestore ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Restaurer ${item.name}`}
                            title="Restaurer"
                            onClick={() => setPendingAction({ item, action: 'restore' })}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : !item.deletedAt && canArchive ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Archiver ${item.name}`}
                            title="Archiver"
                            onClick={() => setPendingAction({ item, action: 'archive' })}
                          >
                            <Archive className="size-4" />
                          </Button>
                        ) : null}
                        {item.deletedAt && canDelete ? (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Supprimer définitivement ${item.name}`}
                            title="Supprimer définitivement"
                            onClick={() => setPendingAction({ item, action: 'delete' })}
                          >
                            <Trash2 className="size-4 text-danger" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList className="mt-5">
            {rows.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!canUpdate}
                onClick={() => open(item)}
                className="flex w-full items-center justify-between gap-3 p-4 text-left disabled:cursor-default"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{item.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.cardCount ?? 0} cartes · {item.slug}
                  </span>
                </span>
                <Badge tone={item.deletedAt ? 'warning' : 'success'}>
                  {item.deletedAt ? 'Archivée' : 'Active'}
                </Badge>
              </button>
            ))}
          </MobileList>
        </>
      ) : null}

      <Drawer
        open={editing !== null}
        onOpenChange={(value) => {
          if (!value && !save.isPending) setEditing(null);
        }}
        title={
          editing === 'new' ? `Ajouter une ${settings.singular}` : `Modifier ${editing?.name ?? ''}`
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {formError ? <ErrorState title="Enregistrement impossible" message={formError} /> : null}
          <label className="block text-sm font-medium">
            Nom
            <Input
              required
              className="mt-1.5"
              value={form.name}
              aria-invalid={Boolean(fieldErrors.name?.length)}
              onChange={(event) => {
                const name = event.target.value;
                setField('name', name);
                if (!slugTouched) setField('slug', slugify(name));
              }}
            />
            <FieldError message={fieldErrors.name?.[0]} />
          </label>
          <label className="block text-sm font-medium">
            Slug
            <Input
              required
              className="mt-1.5"
              value={form.slug}
              aria-invalid={Boolean(fieldErrors.slug?.length)}
              onChange={(event) => {
                setSlugTouched(true);
                setField('slug', event.target.value);
              }}
            />
            <FieldError message={fieldErrors.slug?.[0]} />
          </label>
          {kind === 'seasons' ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block text-sm font-medium">
                Code
                <Input
                  className="mt-1.5"
                  value={form.code}
                  aria-invalid={Boolean(fieldErrors.code?.length)}
                  onChange={(event) => setField('code', event.target.value)}
                />
                <FieldError message={fieldErrors.code?.[0]} />
              </label>
              <label className="block text-sm font-medium">
                Début
                <Input
                  type="date"
                  className="mt-1.5"
                  value={form.startDate}
                  aria-invalid={Boolean(fieldErrors.startDate?.length)}
                  onChange={(event) => setField('startDate', event.target.value)}
                />
                <FieldError message={fieldErrors.startDate?.[0]} />
              </label>
              <label className="block text-sm font-medium">
                Fin
                <Input
                  type="date"
                  className="mt-1.5"
                  value={form.endDate}
                  aria-invalid={Boolean(fieldErrors.endDate?.length)}
                  onChange={(event) => setField('endDate', event.target.value)}
                />
                <FieldError message={fieldErrors.endDate?.[0]} />
              </label>
            </div>
          ) : (
            <label className="block text-sm font-medium">
              Couleur
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  type="color"
                  className="w-14 p-1"
                  value={form.displayColor || '#1f5fc4'}
                  onChange={(event) => setField('displayColor', event.target.value)}
                />
                <Input
                  value={form.displayColor}
                  placeholder="#1f5fc4"
                  aria-invalid={Boolean(fieldErrors.displayColor?.length)}
                  onChange={(event) => setField('displayColor', event.target.value)}
                />
              </div>
              <FieldError message={fieldErrors.displayColor?.[0]} />
            </label>
          )}
          <label className="block text-sm font-medium">
            Description
            <Textarea
              className="mt-1.5"
              value={form.description}
              aria-invalid={Boolean(fieldErrors.description?.length)}
              onChange={(event) => setField('description', event.target.value)}
            />
            <FieldError message={fieldErrors.description?.[0]} />
          </label>
          <label className="block text-sm font-medium">
            Ordre
            <Input
              type="number"
              className="mt-1.5"
              value={form.sortOrder}
              aria-invalid={Boolean(fieldErrors.sortOrder?.length)}
              onChange={(event) => setField('sortOrder', event.target.value)}
            />
            <FieldError message={fieldErrors.sortOrder?.[0]} />
          </label>
          <Switch
            id={`active-${kind}`}
            label="Disponible dans les nouveaux formulaires"
            checked={form.isActive}
            onCheckedChange={(isActive) => setField('isActive', isActive)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={save.isPending} onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button type="submit" loading={save.isPending}>
              {editing === 'new' ? 'Créer' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Drawer>

      <ConfirmDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingAction(null);
        }}
        title={
          pendingAction?.action === 'delete'
            ? 'Suppression définitive'
            : pendingAction?.action === 'restore'
              ? 'Restaurer la ressource'
              : 'Archiver la ressource'
        }
        description={pendingAction ? `Confirmer l'action sur « ${pendingAction.item.name} ».` : ''}
        confirmLabel="Confirmer"
        danger={pendingAction?.action === 'delete'}
        loading={destructive.isPending}
        onConfirm={() => {
          if (pendingAction) destructive.mutate(pendingAction);
        }}
      />
    </div>
  );
}
