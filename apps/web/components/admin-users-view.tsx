'use client';

import {
  ACCOUNT_STATUS_LABELS,
  ROLE_LABELS,
  type AdminUserListItem,
  type AppRole,
  type PaginatedResponse,
} from '@safir/shared-types';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  MobileList,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  Table,
} from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, UserCog } from 'lucide-react';
import Link from 'next/link';
import { useDeferredValue, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

function roleTone(role: AppRole) {
  return role === 'ADMINISTRATOR'
    ? 'danger'
    : role === 'MODERATOR'
      ? 'warning'
      : role === 'PIONEER'
        ? 'primary'
        : 'neutral';
}

function statusTone(status: AdminUserListItem['status']) {
  return status === 'ACTIVE' ? 'success' : status === 'SUSPENDED' ? 'warning' : 'danger';
}

export function AdminUsersView() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (deferredSearch) params.set('search', deferredSearch);
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  const filters = params.toString();
  const users = useQuery({
    queryKey: queryKeys.adminUsers(filters),
    queryFn: () => apiFetch<PaginatedResponse<AdminUserListItem>>(`/api/v1/admin/users?${filters}`),
  });

  return (
    <div>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <SearchInput
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          onClear={() => {
            setSearch('');
            setPage(1);
          }}
          placeholder="Nom d'utilisateur ou e-mail"
          aria-label="Rechercher un utilisateur"
        />
        <Select
          value={role}
          onChange={(event) => {
            setRole(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par rôle"
        >
          <option value="">Tous les rôles</option>
          {Object.entries(ROLE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          aria-label="Filtrer par statut"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {users.isLoading ? <Skeleton className="mt-5 h-96" /> : null}
      {users.isError ? (
        <div className="mt-5">
          <ErrorState
            message="Impossible de charger les utilisateurs."
            action={<Button onClick={() => void users.refetch()}>Réessayer</Button>}
          />
        </div>
      ) : null}
      {users.data?.data.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            title="Aucun utilisateur"
            description="Modifiez la recherche ou les filtres."
          />
        </div>
      ) : null}
      {users.data?.data.length ? (
        <>
          <div className="mt-5 hidden md:block">
            <Table caption="Utilisateurs Safir Pocket">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Utilisateur</th>
                  <th className="px-4 py-3">Rôle</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Inscription</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {users.data.data.map((user) => (
                  <tr key={user.id} className="hover:bg-surface-hover">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                      >
                        <Avatar
                          src={user.avatarUrl}
                          alt={user.username}
                          fallback={user.username}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {user.displayName ?? user.username}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            @{user.username} · {user.email}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone(user.role)}>{user.roleLabel}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(user.status)}>{user.statusLabel}</Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                        new Date(user.createdAt!),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/users/${user.id}`}>
                          <UserCog className="size-4" />
                          Gérer
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList className="mt-5">
            {users.data.data.map((user) => (
              <Link
                key={user.id}
                href={`/admin/users/${user.id}`}
                className="flex w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
              >
                <Avatar
                  src={user.avatarUrl}
                  alt={user.username}
                  fallback={user.username}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {user.displayName ?? user.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={statusTone(user.status)}>{user.statusLabel}</Badge>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </Link>
            ))}
          </MobileList>
          <Pagination
            page={users.data.pagination.page}
            pageCount={users.data.pagination.pageCount}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
