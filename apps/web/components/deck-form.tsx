'use client';

import { Button, Card, ErrorState, Input } from '@safir/ui';
import { deckCreateSchema } from '@safir/validation';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch } from '@/lib/api-client';

export function DeckForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = deckCreateSchema.safeParse({
      name: form.get('name'),
      description: form.get('description') || null,
      visibility: form.get('visibility'),
      format: form.get('format'),
    });
    if (!parsed.success) return setError('Vérifiez le nom et les options du deck.');
    setPending(true);
    try {
      const deck = await apiFetch<{ id: string }>('/api/v1/me/decks', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      router.push(`/decks/${deck.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Création impossible.');
      setPending(false);
    }
  }
  return (
    <Card>
      <form className="space-y-5" onSubmit={submit}>
        <label className="block text-sm font-semibold">
          Nom
          <Input
            name="name"
            className="mt-2"
            required
            maxLength={80}
            placeholder="Gardes du prisme"
          />
        </label>
        <label className="block text-sm font-semibold">
          Description
          <textarea
            name="description"
            maxLength={500}
            className="mt-2 min-h-28 w-full rounded-xl border border-white/10 bg-ink-800/70 p-4 outline-none focus:border-sapphire-400"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Format
            <Input name="format" className="mt-2" defaultValue="open" />
          </label>
          <label className="text-sm font-semibold">
            Visibilité
            <select
              name="visibility"
              className="mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-ink-800 px-4"
            >
              <option value="private">Privé</option>
              <option value="unlisted">Non répertorié</option>
              <option value="public">Public</option>
            </select>
          </label>
        </div>
        {error ? <ErrorState message={error} /> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Création…' : 'Créer le deck'}
        </Button>
      </form>
    </Card>
  );
}
