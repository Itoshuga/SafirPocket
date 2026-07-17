'use client';

import type { ClientToServerEvents, DeckSummary, ServerToClientEvents } from '@safir/shared-types';
import { Button, Card, EmptyState, ErrorState, Spinner } from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { publicEnv } from '@/lib/env';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

type MatchSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function MatchmakingPanel() {
  const decks = useQuery({
    queryKey: ['decks'],
    queryFn: () => apiFetch<DeckSummary[]>('/api/v1/me/decks'),
  });
  const [status, setStatus] = useState<'idle' | 'connecting' | 'queued' | 'matched'>('idle');
  const [message, setMessage] = useState('Choisissez un deck pour rejoindre la file technique.');
  const [selectedDeck, setSelectedDeck] = useState('');
  const socket = useRef<MatchSocket | null>(null);

  useEffect(
    () => () => {
      socket.current?.disconnect();
    },
    [],
  );

  async function joinQueue() {
    if (!selectedDeck) return;
    setStatus('connecting');
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (!data.session) {
      setStatus('idle');
      return setMessage('Votre session a expiré.');
    }
    const connection: MatchSocket = io(`${publicEnv.apiUrl}/match`, {
      auth: { token: data.session.access_token },
      transports: ['websocket', 'polling'],
    });
    socket.current = connection;
    connection.on('connect', () =>
      connection.emit('queue:join', { format: 'open', deckId: selectedDeck }),
    );
    connection.on('queue:joined', () => {
      setStatus('queued');
      setMessage('Recherche d’un adversaire…');
    });
    connection.on('match:found', ({ matchId, opponent }) => {
      setStatus('matched');
      setMessage(
        `Partie ${matchId.slice(0, 8)} trouvée contre ${opponent.displayName ?? opponent.username}.`,
      );
    });
    connection.on('match:error', (error) => {
      setStatus('idle');
      setMessage(error.message);
    });
    connection.on('disconnect', () =>
      setStatus((current) => (current === 'matched' ? current : 'idle')),
    );
  }

  if (decks.isLoading)
    return (
      <div className="grid min-h-64 place-items-center">
        <Spinner />
      </div>
    );
  if (decks.isError) return <ErrorState message="Impossible de charger les decks." />;
  if (!decks.data?.length)
    return (
      <EmptyState title="Créez d’abord un deck">
        La file vérifie toujours que le deck appartient au joueur authentifié.
      </EmptyState>
    );
  return (
    <Card className="relative overflow-hidden p-7 sm:p-10">
      <div className="absolute -right-16 -top-16 size-64 rounded-full bg-sapphire-500/10 blur-3xl" />
      <div className="relative">
        <span className="grid size-16 place-items-center rounded-2xl bg-sapphire-500/10 text-3xl text-sapphire-300">
          ⚔
        </span>
        <h2 className="mt-6 text-2xl font-black">Matchmaking · format ouvert</h2>
        <p className="mt-2 text-slate-400">{message}</p>
        <label className="mt-7 block text-sm font-semibold">
          Deck
          <select
            value={selectedDeck}
            onChange={(event) => setSelectedDeck(event.target.value)}
            disabled={status !== 'idle'}
            className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-ink-800 px-4"
          >
            <option value="">Sélectionner…</option>
            {decks.data.map((deck) => (
              <option value={deck.id} key={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex gap-3">
          <Button onClick={joinQueue} disabled={!selectedDeck || status !== 'idle'}>
            {status === 'connecting'
              ? 'Connexion…'
              : status === 'queued'
                ? 'En file…'
                : status === 'matched'
                  ? 'Match trouvé'
                  : 'Rejoindre la file'}
          </Button>
          {status === 'queued' ? (
            <button
              className="rounded-xl border border-white/10 px-5 font-semibold"
              onClick={() => {
                socket.current?.emit('queue:leave', { format: 'open' });
                socket.current?.disconnect();
                setStatus('idle');
                setMessage('File quittée.');
              }}
            >
              Quitter
            </button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
