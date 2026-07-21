import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageMocks = vi.hoisted(() => ({
  list: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: { from: vi.fn(() => storageMocks) },
  })),
}));

import { BannerStorageService } from './banner-storage.service.js';

const userId = '11111111-1111-4111-8111-111111111111';

function service() {
  return new BannerStorageService({
    getOrThrow: vi.fn((key: string) =>
      key === 'SUPABASE_URL' ? 'https://example.supabase.co' : 'service-role-test-value',
    ),
  } as never);
}

describe('BannerStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMocks.list.mockResolvedValue({
      data: [
        {
          name: 'banner.png',
          metadata: { mimetype: 'image/png', size: 128 },
        },
      ],
      error: null,
    });
    storageMocks.download.mockResolvedValue({
      data: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])]),
      error: null,
    });
    storageMocks.remove.mockResolvedValue({ data: [], error: null });
  });

  it('accepts an owned image after metadata and magic-byte validation', async () => {
    await expect(
      service().verifyOwnedBanner(userId, `${userId}/banner.png`),
    ).resolves.toBeUndefined();
    expect(storageMocks.list).toHaveBeenCalledWith(userId, {
      limit: 10,
      search: 'banner.png',
    });
    expect(storageMocks.download).toHaveBeenCalledWith(`${userId}/banner.png`);
  });

  it('rejects paths outside the authenticated owner folder', async () => {
    await expect(
      service().verifyOwnedBanner(userId, '22222222-2222-4222-8222-222222222222/banner.png'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageMocks.list).not.toHaveBeenCalled();
  });

  it('rejects spoofed image content even when metadata claims an allowed MIME type', async () => {
    storageMocks.download.mockResolvedValueOnce({
      data: new Blob([new Uint8Array([0x00, 0x01, 0x02, 0x03])]),
      error: null,
    });
    await expect(
      service().verifyOwnedBanner(userId, `${userId}/banner.png`),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('removes only stored paths and ignores external legacy URLs', async () => {
    const banners = service();
    await banners.remove(`${userId}/banner.png`);
    await banners.remove('https://cdn.example.com/banner.png');
    expect(storageMocks.remove).toHaveBeenCalledTimes(1);
    expect(storageMocks.remove).toHaveBeenCalledWith([`${userId}/banner.png`]);
  });
});
