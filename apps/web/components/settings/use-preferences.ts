'use client';

import type { UserPreferences } from '@safir/shared-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { useAppStore } from '@/stores/app-store';

export function usePreferences() {
  const client = useQueryClient();
  const notify = useAppStore((state) => state.notify);
  const query = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => apiFetch<UserPreferences>('/api/v1/me/preferences'),
  });
  const update = useMutation({
    mutationFn: (body: Partial<UserPreferences>) =>
      apiFetch<UserPreferences>('/api/v1/me/preferences', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: (preferences) => {
      client.setQueryData(queryKeys.preferences, preferences);
      notify('Préférence enregistrée.', 'success');
    },
    onError: (error) => notify(error.message, 'error'),
  });
  return { query, update };
}
