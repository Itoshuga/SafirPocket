import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maximumAvatarSize = 5 * 1024 * 1024;

@Injectable()
export class AvatarStorageService {
  private readonly client: SupabaseClient;

  constructor(config: ConfigService) {
    this.client = createClient(
      config.getOrThrow<string>('SUPABASE_URL'),
      config.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  }

  async verifyOwnedAvatar(userId: string, path: string): Promise<void> {
    const [folder, fileName, ...rest] = path.split('/');
    if (folder !== userId || !fileName || rest.length > 0) this.invalidAvatar();

    const { data, error } = await this.client.storage
      .from('avatars')
      .list(userId, { limit: 10, search: fileName });
    const object = data?.find(({ name }) => name === fileName);
    if (error || !object) this.invalidAvatar();
    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const mimeType = typeof metadata.mimetype === 'string' ? metadata.mimetype : '';
    const size = typeof metadata.size === 'number' ? metadata.size : Number(metadata.size ?? 0);
    if (!allowedMimeTypes.has(mimeType) || !Number.isFinite(size) || size > maximumAvatarSize) {
      this.invalidAvatar();
    }
  }

  async remove(path: string | null): Promise<void> {
    if (!path || path.startsWith('http://') || path.startsWith('https://')) return;
    await this.client.storage.from('avatars').remove([path]);
  }

  private invalidAvatar(): never {
    throw new BadRequestException({
      code: 'AVATAR_INVALID',
      message: "L'avatar doit être une image JPEG, PNG ou WebP de 5 Mo maximum.",
      fieldErrors: { avatarUrl: ["Le fichier d'avatar est invalide ou inaccessible."] },
    });
  }
}
