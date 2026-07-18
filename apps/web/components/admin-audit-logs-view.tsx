'use client';

import type { AdminAuditLog, PaginatedResponse } from '@safir/shared-types';
import {
  Badge,
  EmptyState,
  ErrorState,
  MobileList,
  Pagination,
  Select,
  Skeleton,
  Table,
} from '@safir/ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function AdminAuditLogsView() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (entityType) params.set('entityType', entityType);
  const filters = params.toString();
  const query = useQuery({
    queryKey: queryKeys.adminAuditLogs(filters),
    queryFn: () =>
      apiFetch<PaginatedResponse<AdminAuditLog>>(`/api/v1/admin/audit-logs?${filters}`),
  });
  const rows = query.data?.data ?? [];
  return (
    <div>
      <Select
        className="max-w-64"
        value={entityType}
        onChange={(event) => {
          setEntityType(event.target.value);
          setPage(1);
        }}
        aria-label="Filtrer par entité"
      >
        <option value="">Toutes les entités</option>
        <option value="USER">Utilisateurs</option>
        <option value="CARD">Cartes</option>
        <option value="CARD_RARITY">Raretés</option>
        <option value="CARD_SEASON">Saisons</option>
        <option value="CARD_TYPE">Types</option>
      </Select>
      {query.isLoading ? <Skeleton className="mt-5 h-96" /> : null}
      {query.isError ? (
        <div className="mt-5">
          <ErrorState message="Impossible de charger le journal administratif." />
        </div>
      ) : null}
      {!query.isLoading && rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState title="Aucune action" />
        </div>
      ) : null}
      {rows.length ? (
        <>
          <div className="mt-5 hidden md:block">
            <Table caption="Journal administratif">
              <thead className="bg-surface-muted text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Acteur</th>
                  <th className="px-4 py-3">Entité</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Requête</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-sm">
                      {new Intl.DateTimeFormat('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(log.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      {log.actor?.displayName ?? log.actor?.username ?? 'Système'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{log.entityType}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="max-w-48 truncate px-4 py-3 text-xs text-muted-foreground">
                      {log.requestId ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <MobileList className="mt-5">
            {rows.map((log) => (
              <div key={log.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{log.action}</p>
                  <Badge>{log.entityType}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {log.actor?.username ?? 'Système'} ·{' '}
                  {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(
                    new Date(log.createdAt),
                  )}
                </p>
              </div>
            ))}
          </MobileList>
          <Pagination
            page={query.data!.pagination.page}
            pageCount={query.data!.pagination.pageCount}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
