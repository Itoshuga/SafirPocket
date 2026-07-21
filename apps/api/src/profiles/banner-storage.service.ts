import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumBannerSize = 8 * 1024 * 1024;

@Injectable()
export class BannerStorageService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async verifyOwnedBanner(userId: string, path: string): Promise<void> {
    const [folder, fileName, ...rest] = path.split('/');
    if (folder !== userId || !fileName || rest.length > 0) this.invalidBanner();

    const bucket = this.client.storage.from('profile-banners');
    const { data: listed, error: listError } = await bucket.list(userId, {
      limit: 10,
      search: fileName,
    });
    const object = listed?.find(({ name }) => name === fileName);
    if (listError || !object) this.invalidBanner();

    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const mimeType = typeof metadata.mimetype === 'string' ? metadata.mimetype : '';
    const size = typeof metadata.size === 'number' ? metadata.size : Number(metadata.size ?? 0);
    if (!allowedMimeTypes.has(mimeType) || !Number.isFinite(size) || size > maximumBannerSize) {
      this.invalidBanner();
    }

    const { data: file, error: downloadError } = await bucket.download(path);
    if (downloadError || !file) this.invalidBanner();
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesImageSignature(bytes, mimeType)) this.invalidBanner();
  }

  async remove(path: string | null): Promise<void> {
    if (!path || path.startsWith('http://') || path.startsWith('https://')) return;
    await this.client.storage.from('profile-banners').remove([path]);
  }

  private invalidBanner(): never {
    throw new BadRequestException({
      code: 'BANNER_INVALID',
      message: 'La bannière doit être une image JPEG, PNG ou WebP de 8 Mo maximum.',
      fieldErrors: { bannerUrl: ['Le fichier de bannière est invalide ou inaccessible.'] },
    });
  }
}

function matchesImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  return (
    mimeType === 'image/webp' &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  );
}
