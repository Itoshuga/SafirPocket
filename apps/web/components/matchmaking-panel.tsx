'use client';

import type { ClientToServerEvents, DeckSummary, ServerToClientEvents } from '@safir/shared-types';
import { Badge, Button, Card, EmptyState, ErrorState, Panel, Select, Skeleton } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, Radio, Swords } from 'lucide-react';
import Link from 'next/link';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { getBrowserApiUrl } from '@/lib/env';
import { queryKeys } from '@/lib/query-keys';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type MatchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type QueueStatus = 'idle' | 'connecting' | 'queued' | 'matched' | 'error';

export function MatchmakingPanel() {
  const decks = useQuery({
    queryKey: queryKeys.decks,
    queryFn: () => apiFetch<DeckSummary[]>('/api/v1/me/decks'),
  });
  const [status, setStatus] = useState<QueueStatus>('idle');
  const [message, setMessage] = useState('Sélectionnez un deck pour rejoindre la file ouverte.');
  const [selectedDeck, setSelectedDeck] = useState('');
  const socket = useRef<MatchSocket | null>(null);
  useEffect(
    () => () => {
      socket.current?.disconnect();
    },
    [],
  );
  function leaveQueue() {
    socket.current?.emit('queue:leave', { format: 'open' });
    socket.current?.disconnect();
    socket.current = null;
    setStatus('idle');
    setMessage('Vous avez quitté la file.');
  }
  async function joinQueue() {
    if (!selectedDeck) return;
    setStatus('connecting');
    setMessage('Connexion au service temps réel…');
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      if (!data.session) throw new Error('Votre session a expiré. Reconnectez-vous.');
      const connection: MatchSocket = io(`${getBrowserApiUrl()}/match`, {
        auth: { token: data.session.access_token },
        transports: ['websocket', 'polling'],
      });
      socket.current = connection;
      connection.on('connect', () =>
        connection.emit('queue:join', { format: 'open', deckId: selectedDeck }),
      );
      connection.on('connect_error', () => {
        setStatus('error');
        setMessage(
          'Connexion au matchmaking impossible. Vérifiez que l’API et Redis sont disponibles.',
        );
      });
      connection.on('queue:joined', () => {
        setStatus('queued');
        setMessage('Recherche d’un adversaire en cours…');
      });
      connection.on('match:found', ({ matchId, opponent }) => {
        setStatus('matched');
        setMessage(
          `Partie ${matchId.slice(0, 8)} trouvée contre ${opponent.displayName ?? opponent.username}.`,
        );
      });
      connection.on('match:error', (error) => {
        setStatus('error');
        setMessage(error.message);
      });
      connection.on('disconnect', () =>
        setStatus((current) => (current === 'matched' ? current : 'idle')),
      );
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Connexion impossible.');
    }
  }
  if (decks.isLoading) return <Skeleton className="h-96" />;
  if (decks.isError)
    return <ErrorState message="Impossible de charger les decks nécessaires au matchmaking." />;
  if (!decks.data?.length)
    return (
      <EmptyState
        icon={<Swords className="size-5" />}
        title="Créez d’abord un deck"
        description="La file vérifie que le deck sélectionné vous appartient."
        action={
          <Button asChild>
            <Link href="/decks/new">Créer un deck</Link>
          </Button>
        }
      />
    );
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <Card className="p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4">
          <span className="grid size-12 place-items-center rounded-md bg-primary-soft text-primary">
            <Swords className="size-6" />
          </span>
          <Badge
            tone={
              status === 'error'
                ? 'danger'
                : status === 'matched'
                  ? 'success'
                  : status === 'queued'
                    ? 'primary'
                    : 'neutral'
            }
          >
            {status === 'idle'
              ? 'Disponible'
              : status === 'connecting'
                ? 'Connexion'
                : status === 'queued'
                  ? 'En file'
                  : status === 'matched'
                    ? 'Match trouvé'
                    : 'Erreur'}
          </Badge>
        </div>
        <h2 className="mt-6 text-xl font-semibold">Matchmaking · format ouvert</h2>
        <p className="mt-2 min-h-12 text-sm leading-6 text-muted-foreground" aria-live="polite">
          {message}
        </p>
        <label className="mt-6 block text-sm font-medium">
          Deck
          <Select
            className="mt-1.5"
            value={selectedDeck}
            onChange={(event) => setSelectedDeck(event.target.value)}
            disabled={status === 'connecting' || status === 'queued' || status === 'matched'}
          >
            <option value="">Sélectionner un deck…</option>
            {decks.data.map((deck) => (
              <option value={deck.id} key={deck.id}>
                {deck.name} · {deck.cardCount} cartes
              </option>
            ))}
          </Select>
        </label>
        <div className="mt-5 flex flex-wrap gap-2">
          {status === 'queued' ? (
            <Button variant="outline" onClick={leaveQueue}>
              Quitter la file
            </Button>
          ) : (
            <Button
              onClick={() => void joinQueue()}
              disabled={!selectedDeck || status === 'connecting' || status === 'matched'}
              loading={status === 'connecting'}
              loadingLabel="Connexion…"
            >
              {status === 'error'
                ? 'Réessayer'
                : status === 'matched'
                  ? 'Match trouvé'
                  : 'Rejoindre la file'}
            </Button>
          )}
        </div>
      </Card>
      <Panel>
        <h2 className="text-sm font-semibold">Étapes techniques</h2>
        <ol className="mt-4 space-y-4 text-sm">
          {[
            { label: 'Deck contrôlé', done: Boolean(selectedDeck) },
            { label: 'Socket authentifié', done: status === 'queued' || status === 'matched' },
            { label: 'Adversaire trouvé', done: status === 'matched' },
          ].map((step) => (
            <li key={step.label} className="flex items-center gap-3">
              {step.done ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : status === 'connecting' || status === 'queued' ? (
                <Radio className="size-4 text-primary" />
              ) : (
                <CircleDot className="size-4 text-muted-foreground" />
              )}
              <span className={step.done ? 'text-foreground' : 'text-muted-foreground'}>
                {step.label}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-border pt-4 text-xs leading-5 text-muted-foreground">
          La fondation temps réel est opérationnelle. L’interface de partie complète reste un
          chantier distinct et n’est pas simulée ici.
        </p>
      </Panel>
    </div>
  );
}
