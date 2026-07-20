import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CardDataExportService } from './card-data-export.service.js';

const actor: AuthenticatedUser = {
  id: crypto.randomUUID(),
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMINISTRATOR',
  status: 'ACTIVE',
  suspendedUntil: null,
};
const exportedCard = {
  id: crypto.randomUUID(),
  setId: null,
  name: '=Sentinelle',
  slug: 'sentinelle-7',
  description: 'Texte ; accentué',
  collectionNumber: '7',
  legacyRarity: 'Rare',
  legacyCardType: 'Créature',
  cost: 2,
  effectText: null,
  effects: [],
  stats: { attack: 3, defense: 4 },
  metadata: { source: 'test' },
  artworkPath: null,
  status: 'published',
  displayOrder: 0,
  number: 7n,
  attack: 3n,
  defense: 4n,
  value: 2n,
  imageUrl: null,
  isCommander: false,
  rarityId: crypto.randomUUID(),
  seasonId: crypto.randomUUID(),
  isActive: true,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  set: null,
  rarity: {
    id: crypto.randomUUID(),
    name: 'Rare',
    slug: 'rare',
    description: null,
    displayColor: null,
    sortOrder: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  season: {
    id: crypto.randomUUID(),
    name: 'Origines',
    slug: 'origines',
    code: 'ORI',
    description: null,
    startDate: null,
    endDate: null,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  },
  typeLinks: [
    {
      cardId: '',
      typeId: crypto.randomUUID(),
      sortOrder: 0,
      createdAt: new Date(),
      type: {
        id: crypto.randomUUID(),
        name: 'Créature',
        slug: 'creature',
        description: null,
        displayColor: null,
        sortOrder: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    },
  ],
};

function serviceFor(count = 1) {
  const operationId = crypto.randomUUID();
  const transaction = {
    cardDataOperation: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn() },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    card: {
      count: vi.fn().mockResolvedValue(count),
      findMany: vi.fn().mockResolvedValueOnce([exportedCard]).mockResolvedValueOnce([]),
    },
    cardDataOperation: {
      create: vi.fn().mockResolvedValue({ id: operationId }),
    },
    runInTransaction: vi.fn((work) => work(transaction)),
  };
  const config = { get: vi.fn().mockReturnValue(50_000) };
  return {
    service: new CardDataExportService(prisma as never, config as never),
    prisma,
    transaction,
  };
}

const baseOptions = {
  format: 'JSON' as const,
  scope: 'FILTERED' as const,
  includeArchived: false,
  includeTechnicalMetadata: false,
  filters: {
    search: 'sentinelle',
    isCommander: false,
    status: 'active' as const,
    archived: 'active' as const,
  },
};

describe('CardDataExportService', () => {
  it('applies current filters in the database estimate', async () => {
    const { service, prisma } = serviceFor();

    await expect(service.estimate(actor, baseOptions)).resolves.toEqual({
      count: 1,
      limit: 50_000,
    });
    expect(prisma.card.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        deletedAt: null,
        isCommander: false,
        isActive: true,
        OR: expect.any(Array),
      }),
    });
  });

  it('rejects an export without results', async () => {
    const { service } = serviceFor(0);
    await expect(service.export(actor, baseOptions, 'request-export-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each(['JSON', 'CSV'] as const)(
    'streams a paginated %s export and audits completion',
    async (format) => {
      const { service, transaction } = serviceFor();
      const result = await service.export(
        actor,
        { ...baseOptions, format, includeTechnicalMetadata: true },
        'request-export-2',
      );
      const content = await streamText(result.stream);

      if (format === 'JSON') {
        const document = JSON.parse(content);
        expect(document.cards[0]).toMatchObject({
          name: '=Sentinelle',
          rarity: { slug: 'rare' },
          types: [{ slug: 'creature' }],
          _technical: { id: exportedCard.id },
        });
      } else {
        expect(content.charCodeAt(0)).toBe(0xfeff);
        expect(content).toContain("'=Sentinelle");
        expect(content).toContain('creature');
      }
      expect(transaction.cardDataOperation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
      );
      expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'CARDS_EXPORTED' }) }),
      );
    },
  );
});

async function streamText(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
