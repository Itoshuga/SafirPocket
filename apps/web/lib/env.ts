export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

export const isSupabaseConfigured = Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);

function usesLoopbackHost(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

export function getBrowserApiUrl(): string {
  if (typeof window === 'undefined') return publicEnv.apiUrl;
  const apiUrl = new URL(publicEnv.apiUrl);
  const pageUrl = new URL(window.location.href);
  if (usesLoopbackHost(apiUrl) && !usesLoopbackHost(pageUrl)) apiUrl.hostname = pageUrl.hostname;
  return apiUrl.origin;
}

export function getBrowserAppUrl(): string {
  return typeof window === 'undefined' ? publicEnv.appUrl : window.location.origin;
}
