import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { AdminTaxonomiesService } from './admin-taxonomies.service.js';

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
  description: null,
  displayColor: '#9A6700',
  sortOrder: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  _count: { cards: 0 },
};
const season = {
  id: crypto.randomUUID(),
  name: 'Origines',
  slug: 'origines',
  code: 'ORI',
  description: null,
  startDate: null,
  endDate: null,
  sortOrder: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  _count: { cards: 0 },
};
const cardType = {
  id: crypto.randomUUID(),
  name: 'Allié',
  slug: 'allie',
  description: null,
  displayColor: '#1F5FC4',
  sortOrder: 1,
  isActive: true,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  _count: { links: 0 },
};

function serviceFor(used = false) {
  const withUsage = <T extends typeof rarity | typeof season | typeof cardType>(row: T): T =>
    ({
      ...row,
      _count: 'cards' in row._count ? { cards: used ? 1 : 0 } : { links: used ? 1 : 0 },
    }) as T;
  const model = <T extends typeof rarity | typeof season | typeof cardType>(row: T) => ({
    create: vi.fn().mockResolvedValue(withUsage(row)),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(withUsage(row)),
    update: vi
      .fn()
      .mockImplementation(({ data }) =>
        Promise.resolve(withUsage({ ...row, ...data, updatedAt: new Date() } as T)),
      ),
    delete: vi.fn().mockResolvedValue(row),
  });
  const transaction = {
    cardRarity: model(rarity),
    cardSeason: model(season),
    cardType: model(cardType),
    card: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    adminAuditLog: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { runInTransaction: vi.fn((operation) => operation(transaction)) };
  return { service: new AdminTaxonomiesService(prisma as never), transaction };
}

const cases = [
  {
    label: 'rarity',
    create: (service: AdminTaxonomiesService) =>
      service.createRarity(
        actor,
        {
          name: rarity.name,
          slug: rarity.slug,
          description: null,
          displayColor: rarity.displayColor,
          sortOrder: 1,
          isActive: true,
        },
        'request-taxonomy',
      ),
    update: (service: AdminTaxonomiesService) =>
      service.updateRarity(actor, rarity.id, { name: 'Très rare' }, 'request-taxonomy'),
    archive: (service: AdminTaxonomiesService) =>
      service.archiveRarity(actor, rarity.id, 'request-taxonomy'),
    restore: (service: AdminTaxonomiesService) =>
      service.restoreRarity(actor, rarity.id, 'request-taxonomy'),
    remove: (service: AdminTaxonomiesService) =>
      service.deleteRarity(actor, rarity.id, 'request-taxonomy'),
  },
  {
    label: 'season',
    create: (service: AdminTaxonomiesService) =>
      service.createSeason(
        actor,
        {
          name: season.name,
          slug: season.slug,
          code: season.code,
          sortOrder: 1,
          isActive: true,
        },
        'request-taxonomy',
      ),
    update: (service: AdminTaxonomiesService) =>
      service.updateSeason(actor, season.id, { name: 'Origines II' }, 'request-taxonomy'),
    archive: (service: AdminTaxonomiesService) =>
      service.archiveSeason(actor, season.id, 'request-taxonomy'),
    restore: (service: AdminTaxonomiesService) =>
      service.restoreSeason(actor, season.id, 'request-taxonomy'),
    remove: (service: AdminTaxonomiesService) =>
      service.deleteSeason(actor, season.id, 'request-taxonomy'),
  },
  {
    label: 'card type',
    create: (service: AdminTaxonomiesService) =>
      service.createType(
        actor,
        {
          name: cardType.name,
          slug: cardType.slug,
          description: null,
          displayColor: cardType.displayColor,
          sortOrder: 1,
          isActive: true,
        },
        'request-taxonomy',
      ),
    update: (service: AdminTaxonomiesService) =>
      service.updateType(actor, cardType.id, { name: 'Champion' }, 'request-taxonomy'),
    archive: (service: AdminTaxonomiesService) =>
      service.archiveType(actor, cardType.id, 'request-taxonomy'),
    restore: (service: AdminTaxonomiesService) =>
      service.restoreType(actor, cardType.id, 'request-taxonomy'),
    remove: (service: AdminTaxonomiesService) =>
      service.deleteType(actor, cardType.id, 'request-taxonomy'),
  },
];

describe('AdminTaxonomiesService', () => {
  it.each(cases)(
    '$label supports create, update, archive and restore with audit',
    async (testCase) => {
      const { service, transaction } = serviceFor();

      await testCase.create(service);
      await testCase.update(service);
      await testCase.archive(service);
      await testCase.restore(service);

      expect(transaction.adminAuditLog.create).toHaveBeenCalledTimes(4);
    },
  );

  it.each(cases)('$label refuses permanent deletion while referenced', async (testCase) => {
    const { service } = serviceFor(true);

    await expect(testCase.remove(service)).rejects.toBeInstanceOf(ConflictException);
  });
});
