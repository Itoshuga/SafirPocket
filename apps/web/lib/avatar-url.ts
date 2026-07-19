import { publicEnv } from './env';

export function resolveAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (!publicEnv.supabaseUrl) return null;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/avatars/${encodedPath}`;
}
