import { ConflictException, ForbiddenException, GoneException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { CardDataImportService } from './card-data-import.service.js';

const actor: AuthenticatedUser = {
  id: crypto.randomUUID(),
  email: 'admin@example.com',
  username: 'admin',
  role: 'ADMINISTRATOR',
  status: 'ACTIVE',
  suspendedUntil: null,
};
const rarity = {
  id: crypto.randomUUID(),
  name: 'Rare',
  slug: 'rare',
  isActive: true,
  deletedAt: null,
};
const season = {
  id: crypto.randomUUID(),
  name: 'Origines',
  slug: 'origines',
  isActive: true,
  deletedAt: null,
};
const type = {
  id: crypto.randomUUID(),
  name: 'Créature',
  slug: 'creature',
  isActive: true,
  deletedAt: null,
};
const card = {
  name: 'Sentinelle',
  number: 7,
  attack: 3,
  defense: 4,
  value: 2,
  description: null,
  imageUrl: null,
  isCommander: false,
  rarity: { slug: rarity.slug, name: rarity.name },
  season: { slug: season.slug, name: season.name },
  types: [{ slug: type.slug, name: type.name }],
  isActive: true,
  metadata: {},
};

function upload(cards: unknown[]) {
  const buffer = Buffer.from(JSON.stringify({ format: 'safir-cards', version: 1, cards }));
  return {
    buffer,
    originalname: 'cards.json',
    mimetype: 'application/json',
    size: buffer.length,
  };
}

function serviceFor({
  rarities = [rarity],
  seasons = [season],
  types = [type],
  existingCards = [],
}: {
  rarities?: (typeof rarity)[];
  seasons?: (typeof season)[];
  types?: (typeof type)[];
  existingCards?: Array<{ id: string; seasonId: string; number: bigint; deletedAt: Date | null }>;
} = {}) {
  const operationId = crypto.randomUUID();
  const transaction = {
    cardDataOperation: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          id: operationId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
    card: { create: vi.fn(), update: vi.fn() },
  };
  const prisma = {
    cardRarity: { findMany: vi.fn().mockResolvedValue(rarities) },
    cardSeason: { findMany: vi.fn().mockResolvedValue(seasons) },
    cardType: { findMany: vi.fn().mockResolvedValue(types) },
    card: { findMany: vi.fn().mockResolvedValue(existingCards) },
    runInTransaction: vi.fn((work) => work(transaction)),
  };
  const config = {
    get: vi.fn(
      (key: string) =>
        ({
          CARD_IMPORT_MAX_FILE_BYTES: 5_242_880,
          CARD_IMPORT_MAX_ROWS: 5_000,
          CARD_IMPORT_PREVIEW_TTL_SECONDS: 900,
        })[key],
    ),
  };
  return {
    service: new CardDataImportService(prisma as never, config as never),
    prisma,
    transaction,
  };
}

const options = {
  format: 'JSON' as const,
  mode: 'CREATE_ONLY' as const,
  conflictBehavior: 'ERROR' as const,
  createMissingRelations: false,
};

describe('CardDataImportService preview', () => {
  it('validates and stores a preview without modifying any card', async () => {
    const { service, transaction } = serviceFor();
    const preview = await service.preview(actor, upload([card]), options, 'request-preview-1');

    expect(preview).toMatchObject({
      canExecute: true,
      summary: { totalRows: 1, createCount: 1, updateCount: 0, errorCount: 0 },
      rows: [{ row: 1, action: 'CREATE' }],
    });
    expect(transaction.card.create).not.toHaveBeenCalled();
    expect(transaction.card.update).not.toHaveBeenCalled();
    expect(transaction.cardDataOperation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PREVIEWED' }) }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CARDS_IMPORT_PREVIEWED' }),
      }),
    );
  });

  it('reports a missing relation with a stable row-level error', async () => {
    const { service } = serviceFor({ rarities: [] });
    const preview = await service.preview(actor, upload([card]), options, 'request-preview-2');

    expect(preview.canExecute).toBe(false);
    expect(preview.errors).toContainEqual(
      expect.objectContaining({ row: 1, field: 'rarity', code: 'RARITY_NOT_FOUND' }),
    );
  });

  it('marks every occurrence of a duplicate season and number', async () => {
    const { service } = serviceFor();
    const preview = await service.preview(
      actor,
      upload([card, card]),
      options,
      'request-preview-3',
    );

    expect(preview.summary.errorCount).toBe(2);
    expect(preview.errors.filter(({ code }) => code === 'CARD_IMPORT_DUPLICATE_ROWS')).toHaveLength(
      2,
    );
  });

  it('resolves an existing card for UPSERT', async () => {
    const existingId = crypto.randomUUID();
    const { service } = serviceFor({
      existingCards: [{ id: existingId, seasonId: season.id, number: 7n, deletedAt: null }],
    });
    const preview = await service.preview(
      actor,
      upload([card]),
      { ...options, mode: 'UPSERT' },
      'request-preview-4',
    );

    expect(preview.rows).toContainEqual(
      expect.objectContaining({ action: 'UPDATE', existingCardId: existingId }),
    );
  });

  it('keeps automatic taxonomy creation administrator-only in the service', async () => {
    const { service, prisma } = serviceFor({ rarities: [] });
    const moderator = { ...actor, role: 'MODERATOR' as const };

    await expect(
      service.preview(
        moderator,
        upload([card]),
        { ...options, createMissingRelations: true },
        'request-preview-5',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.runInTransaction).not.toHaveBeenCalled();
  });
});

describe('CardDataImportService preview token', () => {
  it('rejects an expired preview and clears its temporary payload', async () => {
    const { service, prisma } = executionService({
      status: 'PREVIEWED',
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      service.execute(
        actor,
        { importPreviewId: prisma.operation.id, fileHash: cardImportHash },
        'request-execute-1',
      ),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.cardDataOperation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXPIRED' }) }),
    );
  });

  it('rejects a second execution', async () => {
    const { service, prisma } = executionService({ status: 'COMPLETED' });
    await expect(
      service.execute(
        actor,
        { importPreviewId: prisma.operation.id, fileHash: cardImportHash },
        'request-execute-2',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a hash changed after preview', async () => {
    const { service, prisma } = executionService({ status: 'PREVIEWED' });
    await expect(
      service.execute(
        actor,
        { importPreviewId: prisma.operation.id, fileHash: 'b'.repeat(64) },
        'request-execute-3',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CARD_IMPORT_FILE_CHANGED' }),
    });
  });
});

describe('CardDataImportService execution transaction', () => {
  it('creates a card, its standard variant and type links in the claimed transaction', async () => {
    const { service, transaction, operation } = executableService('CREATE');
    const result = await service.execute(
      actor,
      { importPreviewId: operation.id, fileHash: cardImportHash },
      'request-execute-4',
    );

    expect(result).toMatchObject({ status: 'COMPLETED', summary: { createCount: 1 } });
    expect(transaction.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          typeLinks: {
            create: [expect.objectContaining({ type: { connect: { id: type.id } }, sortOrder: 0 })],
          },
          variants: { create: expect.objectContaining({ slug: 'standard' }) },
        }),
      }),
    );
    expect(transaction.cardDataOperation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }),
    );
  });

  it('replaces all type links during an imported update', async () => {
    const { service, transaction, operation, existingId } = executableService('UPDATE');
    await service.execute(
      actor,
      { importPreviewId: operation.id, fileHash: cardImportHash },
      'request-execute-5',
    );

    expect(transaction.cardTypeLink.deleteMany).toHaveBeenCalledWith({
      where: { cardId: existingId },
    });
    expect(transaction.cardTypeLink.createMany).toHaveBeenCalledWith({
      data: [{ cardId: existingId, typeId: type.id, sortOrder: 0 }],
    });
    expect(transaction.card.update).toHaveBeenCalled();
  });
});

const cardImportHash = 'a'.repeat(64);

function executionService(overrides: { status: string; expiresAt?: Date }) {
  const operation = {
    id: crypto.randomUUID(),
    actorUserId: actor.id,
    operationType: 'IMPORT',
    fileHash: cardImportHash,
    status: overrides.status,
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000),
    previewPayload: {},
  };
  const prisma = {
    operation,
    cardDataOperation: {
      findUnique: vi.fn().mockResolvedValue(operation),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  return {
    service: new CardDataImportService(prisma as never, { get: vi.fn() } as never),
    prisma,
  };
}

function executableService(action: 'CREATE' | 'UPDATE') {
  const existingId = crypto.randomUUID();
  const operation = {
    id: crypto.randomUUID(),
    actorUserId: actor.id,
    operationType: 'IMPORT',
    fileHash: cardImportHash,
    status: 'PREVIEWED',
    expiresAt: new Date(Date.now() + 60_000),
    previewPayload: {
      options: {
        format: 'JSON',
        mode: action === 'CREATE' ? 'CREATE_ONLY' : 'UPDATE_ONLY',
        conflictBehavior: 'ERROR',
        createMissingRelations: false,
      },
      canExecute: true,
      summary: {
        totalRows: 1,
        validRows: 1,
        createCount: action === 'CREATE' ? 1 : 0,
        updateCount: action === 'UPDATE' ? 1 : 0,
        skippedCount: 0,
        errorCount: 0,
      },
      rows: [
        {
          row: 1,
          item: card,
          rarity: { id: rarity.id, name: rarity.name, slug: rarity.slug, missing: false },
          season: { id: season.id, name: season.name, slug: season.slug, missing: false },
          types: [{ id: type.id, name: type.name, slug: type.slug, missing: false }],
          action,
          existingCardId: action === 'UPDATE' ? existingId : null,
          warnings: [],
        },
      ],
      missingRelations: { rarities: [], seasons: [], types: [] },
    },
  };
  const storedCard = {
    id: existingId,
    seasonId: season.id,
    number: 7n,
    deletedAt: null,
  };
  const transaction = {
    cardDataOperation: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    cardRarity: { findMany: vi.fn().mockResolvedValue([rarity]) },
    cardSeason: { findMany: vi.fn().mockResolvedValue([season]) },
    cardType: { findMany: vi.fn().mockResolvedValue([type]) },
    card: {
      findFirst: vi.fn().mockResolvedValue(action === 'UPDATE' ? storedCard : null),
      create: vi.fn().mockResolvedValue({ id: crypto.randomUUID() }),
      update: vi.fn().mockResolvedValue(storedCard),
    },
    cardTypeLink: {
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cardVariant: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn(),
    },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    cardDataOperation: { findUnique: vi.fn().mockResolvedValue(operation) },
    runInTransaction: vi.fn((work) => work(transaction)),
  };
  return {
    service: new CardDataImportService(prisma as never, { get: vi.fn() } as never),
    transaction,
    operation,
    existingId,
  };
}
