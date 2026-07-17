import type { ApiErrorBody } from '@safir/shared-types';
import { publicEnv } from './env';
import { getSupabaseBrowserClient } from './supabase-browser';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('content-type', 'application/json');
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token)
      headers.set('authorization', `Bearer ${data.session.access_token}`);
  } catch {
    // Public calls work without Supabase; protected calls receive a normalized 401 from the API.
  }
  const response = await fetch(`${publicEnv.apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiClientError(
      response.status,
      body?.error.code ?? 'REQUEST_FAILED',
      body?.error.message ?? 'La requête a échoué.',
    );
  }
  return (await response.json()) as T;
}
