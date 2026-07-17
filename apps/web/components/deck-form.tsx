'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, ErrorState, Input, Select, Textarea } from '@safir/ui';
import { deckCreateSchema } from '@safir/validation';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { ApiClientError, apiFetch } from '@/lib/api-client';

export function DeckForm() {
  const deckFormSchema = deckCreateSchema.omit({ metadata: true });
  type DeckFormInput = z.input<typeof deckFormSchema>;
  type DeckFormOutput = z.output<typeof deckFormSchema>;
  const router = useRouter();
  const form = useForm<DeckFormInput, unknown, DeckFormOutput>({
    resolver: zodResolver(deckFormSchema),
    defaultValues: { name: '', description: null, visibility: 'private', format: 'open' },
  });
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors('root');
    try {
      const deck = await apiFetch<{ id: string }>('/api/v1/me/decks', {
        method: 'POST',
        body: JSON.stringify({ ...values, metadata: {} }),
      });
      router.push(`/decks/${deck.id}`);
    } catch (error) {
      form.setError('root', {
        message: error instanceof ApiClientError ? error.message : 'Création impossible.',
      });
    }
  });
  return (
    <Card>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <label className="block text-sm font-medium">
          Nom
          <Input
            className="mt-1.5"
            placeholder="Gardes du prisme"
            aria-invalid={Boolean(form.formState.errors.name)}
            {...form.register('name')}
          />
        </label>
        {form.formState.errors.name ? (
          <p className="-mt-3 text-xs text-danger">{form.formState.errors.name.message}</p>
        ) : null}
        <label className="block text-sm font-medium">
          Description
          <Textarea
            className="mt-1.5"
            maxLength={500}
            {...form.register('description', { setValueAs: (value) => value || null })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Format
            <Input className="mt-1.5" {...form.register('format')} />
          </label>
          <label className="text-sm font-medium">
            Visibilité
            <Select className="mt-1.5" {...form.register('visibility')}>
              <option value="private">Privé</option>
              <option value="unlisted">Non répertorié</option>
              <option value="public">Public</option>
            </Select>
          </label>
        </div>
        {form.formState.errors.root?.message ? (
          <ErrorState message={form.formState.errors.root.message} />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={form.formState.isSubmitting} loadingLabel="Création…">
            Créer le deck
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push('/decks')}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}
