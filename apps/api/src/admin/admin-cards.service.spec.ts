import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { AdminCardsService } from './admin-cards.service.js';

const now = new Date();
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
  displayColor: null,
  isActive: true,
  deletedAt: null,
};
const season = {
  id: crypto.randomUUID(),
  name: 'Origines',
  slug: 'origines',
  code: 'ORI',
  isActive: true,
  deletedAt: null,
};
const types = [
  { id: crypto.randomUUID(), name: 'Allié', slug: 'allie', displayColor: null },
  { id: crypto.randomUUID(), name: 'Terre', slug: 'terre', displayColor: null },
];

function card(overrides: Record<string, unknown> = {}) {
  const id = crypto.randomUUID();
  return {
    id,
    setId: null,
    name: 'Sentinelle',
    slug: 'sentinelle-7',
    number: 7n,
    collectionNumber: '7',
    attack: 3n,
    defense: 4n,
    value: 2n,
    description: null,
    imageUrl: null,
    artworkPath: null,
    isCommander: false,
    rarityId: rarity.id,
    seasonId: season.id,
    cost: 2,
    status: 'published' as const,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    set: null,
    rarity,
    season,
    typeLinks: types.map((type, sortOrder) => ({ typeId: type.id, sortOrder, type })),
    ...overrides,
  };
}

const input = {
  name: 'Sentinelle',
  number: 7,
  attack: 3,
  defense: 4,
  value: 2,
  description: null,
  imageUrl: null,
  isCommander: false,
  rarityId: rarity.id,
  seasonId: season.id,
  typeIds: types.map(({ id }) => id),
  isActive: true,
};

function serviceFor(
  options: {
    rarity?: typeof rarity | null;
    season?: typeof season | null;
    types?: ReadonlyArray<(typeof types)[number]>;
    auditError?: Error;
    createError?: unknown;
  } = {},
) {
  const storedCard = card();
  const transaction = {
    cardRarity: {
      findFirst: vi.fn().mockResolvedValue(options.rarity === undefined ? rarity : options.rarity),
    },
    cardSeason: {
      findFirst: vi.fn().mockResolvedValue(options.season === undefined ? season : options.season),
    },
    cardType: {
      findMany: vi.fn().mockResolvedValue(options.types ?? types),
    },
    card: {
      create: options.createError
        ? vi.fn().mockRejectedValue(options.createError)
        : vi.fn().mockResolvedValue(storedCard),
      findUnique: vi.fn().mockResolvedValue(storedCard),
      update: vi
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ ...storedCard, ...data, updatedAt: new Date() }),
        ),
    },
    cardTypeLink: {
      deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
    adminAuditLog: {
      create: options.auditError
        ? vi.fn().mockRejectedValue(options.auditError)
        : vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = { runInTransaction: vi.fn((operation) => operation(transaction)) };
  return { service: new AdminCardsService(prisma as never), transaction, prisma, storedCard };
}

describe('AdminCardsService', () => {
  it('creates a card with multiple relational types and an audit record', async () => {
    const { service, transaction } = serviceFor();

    await expect(service.create(actor, input, 'request-card-1')).resolves.toMatchObject({
      number: 7,
      types: [{ name: 'Allié' }, { name: 'Terre' }],
    });
    expect(transaction.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          rarityId: rarity.id,
          seasonId: season.id,
          typeLinks: { create: input.typeIds.map((typeId, sortOrder) => ({ typeId, sortOrder })) },
        }),
      }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CARD_CREATED' }) }),
    );
  });

  it.each([
    [{ rarity: null }, 'RARITY_NOT_FOUND'],
    [{ season: null }, 'SEASON_NOT_FOUND'],
    [{ types: [types[0]!] }, 'CARD_TYPE_NOT_FOUND'],
  ] as const)('rejects an invalid catalog relation', async (options, code) => {
    const { service } = serviceFor(options);

    await expect(service.create(actor, input, 'request-card-2')).rejects.toMatchObject({
      response: expect.objectContaining({ code }),
    });
  });

  it('maps a duplicate season number to a stable API conflict', async () => {
    const { service } = serviceFor({ createError: { code: 'P2002' } });

    await expect(service.create(actor, input, 'request-card-3')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('updates fields and replaces type links in the same transaction', async () => {
    const { service, transaction, storedCard } = serviceFor({ types: [types[1]!] });

    await service.update(
      actor,
      storedCard.id,
      { name: 'Sentinelle majeure', typeIds: [types[1]!.id] },
      'request-card-4',
    );

    expect(transaction.cardTypeLink.deleteMany).toHaveBeenCalledWith({
      where: { cardId: storedCard.id },
    });
    expect(transaction.cardTypeLink.createMany).toHaveBeenCalled();
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'CARD_UPDATED' }) }),
    );
  });

  it.each([
    ['archive', 'CARD_ARCHIVED', true],
    ['restore', 'CARD_RESTORED', false],
  ] as const)('%s changes soft-deletion state and audits it', async (method, action, archived) => {
    const { service, transaction, storedCard } = serviceFor();

    await service[method](actor, storedCard.id, 'request-card-5');

    expect(transaction.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: archived ? expect.any(Date) : null }),
      }),
    );
    expect(transaction.adminAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action }) }),
    );
  });

  it('propagates an audit failure so the enclosing transaction can roll back', async () => {
    const { service, prisma } = serviceFor({ auditError: new Error('audit unavailable') });

    await expect(service.create(actor, input, 'request-card-6')).rejects.toThrow(
      'audit unavailable',
    );
    expect(prisma.runInTransaction).toHaveBeenCalledTimes(1);
  });

  it('reports a missing card on update', async () => {
    const { service, transaction } = serviceFor();
    transaction.card.findUnique.mockResolvedValueOnce(null as never);

    await expect(
      service.update(actor, crypto.randomUUID(), { name: 'Inconnue' }, 'request-card-7'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
