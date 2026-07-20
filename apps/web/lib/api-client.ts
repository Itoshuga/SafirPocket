import type { ApiErrorBody } from '@safir/shared-types';
import { getBrowserApiUrl } from './env';
import { getSupabaseBrowserClient } from './supabase-browser';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fieldErrors?: Record<string, string[]>,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function apiHeaders(init: RequestInit): Promise<Headers> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData))
    headers.set('content-type', 'application/json');
  try {
    const { data } = await getSupabaseBrowserClient().auth.getSession();
    if (data.session?.access_token)
      headers.set('authorization', `Bearer ${data.session.access_token}`);
  } catch {
    // Public calls work without Supabase; protected calls receive a normalized 401 from the API.
  }
  return headers;
}

async function apiRequest(path: string, init: RequestInit): Promise<Response> {
  const headers = await apiHeaders(init);
  let response: Response;
  try {
    response = await fetch(`${getBrowserApiUrl()}${path}`, { ...init, headers });
  } catch {
    throw new ApiClientError(
      0,
      'NETWORK_ERROR',
      "L'API Safir Pocket est inaccessible pour le moment.",
    );
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const error = body && 'error' in body ? body.error : body;
    throw new ApiClientError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'La requête a échoué.',
      error?.fieldErrors,
      error?.requestId,
    );
  }
  return response;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiRequest(path, init);
  return (await response.json()) as T;
}

export async function apiDownload(
  path: string,
  init: RequestInit = {},
): Promise<{ blob: Blob; fileName: string }> {
  const response = await apiRequest(path, init);
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const simple = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  return {
    blob: await response.blob(),
    fileName: encoded ? decodeURIComponent(encoded) : (simple ?? 'safir-cards'),
  };
}
