import { publicEnv } from './env';

export function resolveBannerUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path;
  }
  if (!publicEnv.supabaseUrl) return null;
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/profile-banners/${encodedPath}`;
}
