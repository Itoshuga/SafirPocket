'use client';

import type {
  BlockedUser,
  FriendRequest,
  Friendship,
  PaginatedResponse,
  UserSearchResult,
} from '@safir/shared-types';
import {
  ConfirmDialog,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Panel,
  SearchInput,
  Skeleton,
  Tabs,
} from '@safir/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserRoundCheck } from 'lucide-react';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';
import {
  BlockedUserItem,
  FriendListItem,
  FriendRequestCard,
  UserSearchResultItem,
} from './social-list-items';

type SocialAction = { type: 'remove'; userId: string } | { type: 'block'; userId: string } | null;

export function FriendsSettings() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const [tab, setTab] = useState('friends');
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState<SocialAction>(null);
  const friends = useQuery({
    queryKey: queryKeys.friends,
    queryFn: () => apiFetch<Friendship[]>('/api/v1/me/friends'),
  });
  const received = useQuery({
    queryKey: queryKeys.friendRequestsReceived,
    queryFn: () => apiFetch<FriendRequest[]>('/api/v1/me/friend-requests'),
  });
  const sent = useQuery({
    queryKey: queryKeys.friendRequestsSent,
    queryFn: () => apiFetch<FriendRequest[]>('/api/v1/me/friend-requests/sent'),
  });
  const blocked = useQuery({
    queryKey: queryKeys.blockedUsers,
    queryFn: () => apiFetch<BlockedUser[]>('/api/v1/me/blocked-users'),
  });
  const filters = new URLSearchParams({
    query: submittedSearch,
    page: String(page),
    pageSize: '20',
  }).toString();
  const results = useQuery({
    queryKey: queryKeys.userSearch(filters),
    queryFn: () => apiFetch<PaginatedResponse<UserSearchResult>>(`/api/v1/users/search?${filters}`),
    enabled: submittedSearch.length >= 2,
  });

  const refreshSocial = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.friends }),
      client.invalidateQueries({ queryKey: queryKeys.friendRequestsReceived }),
      client.invalidateQueries({ queryKey: queryKeys.friendRequestsSent }),
      client.invalidateQueries({ queryKey: queryKeys.blockedUsers }),
      client.invalidateQueries({ queryKey: ['user-search'] }),
      client.invalidateQueries({ queryKey: queryKeys.profileSummary }),
    ]);
  };
  const action = useMutation({
    mutationFn: ({ path, method }: { path: string; method: 'POST' | 'DELETE' }) =>
      apiFetch<unknown>(path, {
        method,
        ...(method === 'POST' ? { body: JSON.stringify({}) } : {}),
      }),
    onSuccess: async () => {
      setConfirmation(null);
      notify('Action enregistrée.', 'success');
      await refreshSocial();
    },
    onError: (error) => notify(error.message, 'error'),
  });
  const call = (path: string, method: 'POST' | 'DELETE' = 'POST') =>
    action.mutate({ path, method });

  const loading = friends.isLoading || received.isLoading || sent.isLoading || blocked.isLoading;
  const hasError = friends.isError || received.isError || sent.isError || blocked.isError;
  if (loading) return <Skeleton className="h-[34rem]" />;
  if (hasError) return <ErrorState message="Les données sociales ne sont pas disponibles." />;

  const empty = (title: string, description: string) => (
    <EmptyState
      compact
      title={title}
      description={description}
      icon={<UserRoundCheck className="size-5" />}
    />
  );
  return (
    <Panel>
      <h2 className="text-base font-semibold">Amis</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Retrouvez vos relations, vos demandes et les comptes que vous avez bloqués.
      </p>
      <div className="mt-5">
        <Tabs
          value={tab}
          onValueChange={setTab}
          tabs={[
            { value: 'friends', label: `Amis (${friends.data?.length ?? 0})` },
            { value: 'received', label: `Reçues (${received.data?.length ?? 0})` },
            { value: 'sent', label: `Envoyées (${sent.data?.length ?? 0})` },
            { value: 'search', label: 'Recherche' },
            { value: 'blocked', label: `Bloqués (${blocked.data?.length ?? 0})` },
          ]}
        >
          <Tabs.Content value="friends">
            {friends.data?.length
              ? friends.data.map((friendship) => (
                  <FriendListItem
                    key={friendship.id}
                    friendship={friendship}
                    pending={action.isPending}
                    onRemove={() => setConfirmation({ type: 'remove', userId: friendship.user.id })}
                    onBlock={() => setConfirmation({ type: 'block', userId: friendship.user.id })}
                  />
                ))
              : empty('Aucun ami', 'Utilisez la recherche pour trouver un joueur.')}
          </Tabs.Content>
          <Tabs.Content value="received">
            {received.data?.length
              ? received.data.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    direction="received"
                    pending={action.isPending}
                    onAccept={() => call(`/api/v1/me/friend-requests/${request.id}/accept`)}
                    onDecline={() => call(`/api/v1/me/friend-requests/${request.id}/decline`)}
                  />
                ))
              : empty('Aucune demande reçue', 'Les nouvelles demandes apparaîtront ici.')}
          </Tabs.Content>
          <Tabs.Content value="sent">
            {sent.data?.length
              ? sent.data.map((request) => (
                  <FriendRequestCard
                    key={request.id}
                    request={request}
                    direction="sent"
                    pending={action.isPending}
                    onCancel={() => call(`/api/v1/me/friend-requests/${request.id}`, 'DELETE')}
                  />
                ))
              : empty('Aucune demande envoyée', "Vous n'avez pas de demande en attente.")}
          </Tabs.Content>
          <Tabs.Content value="search">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                const query = search.trim();
                if (query.length < 2) return;
                setPage(1);
                setSubmittedSearch(query);
              }}
            >
              <SearchInput
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onClear={() => {
                  setSearch('');
                  setSubmittedSearch('');
                }}
                placeholder="Rechercher par username"
                aria-label="Rechercher un joueur"
              />
              <Button type="submit">
                <Search className="size-4" /> Rechercher
              </Button>
            </form>
            <div className="mt-5">
              {results.isLoading ? <Skeleton className="h-40" /> : null}
              {results.isError ? <ErrorState message="Recherche impossible." /> : null}
              {results.data?.data.length
                ? results.data.data.map((result) => (
                    <UserSearchResultItem
                      key={result.id}
                      result={result}
                      pending={action.isPending}
                      onRequest={() => call(`/api/v1/users/${result.id}/friend-request`)}
                      onBlock={() => setConfirmation({ type: 'block', userId: result.id })}
                    />
                  ))
                : submittedSearch && !results.isLoading
                  ? empty('Aucun joueur trouvé', 'Essayez un autre username.')
                  : null}
              {results.data ? (
                <Pagination
                  page={results.data.pagination.page}
                  pageCount={results.data.pagination.pageCount}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          </Tabs.Content>
          <Tabs.Content value="blocked">
            {blocked.data?.length
              ? blocked.data.map((block) => (
                  <BlockedUserItem
                    key={block.user.id}
                    block={block}
                    pending={action.isPending}
                    onUnblock={() => call(`/api/v1/users/${block.user.id}/block`, 'DELETE')}
                  />
                ))
              : empty('Aucun utilisateur bloqué', 'Votre liste de blocage est vide.')}
          </Tabs.Content>
        </Tabs>
      </div>
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
        title={confirmation?.type === 'block' ? 'Bloquer cet utilisateur ?' : 'Retirer cet ami ?'}
        description={
          confirmation?.type === 'block'
            ? "Les demandes en attente et l'amitié seront annulées sans notification."
            : 'Cette personne sera retirée de votre liste d amis.'
        }
        confirmLabel={confirmation?.type === 'block' ? 'Bloquer' : 'Retirer'}
        danger={confirmation?.type === 'block'}
        loading={action.isPending}
        onConfirm={() => {
          if (!confirmation) return;
          call(
            confirmation.type === 'block'
              ? `/api/v1/users/${confirmation.userId}/block`
              : `/api/v1/me/friends/${confirmation.userId}`,
            confirmation.type === 'block' ? 'POST' : 'DELETE',
          );
        }}
      />
    </Panel>
  );
}
