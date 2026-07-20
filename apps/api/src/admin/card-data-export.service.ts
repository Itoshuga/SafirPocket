import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  hasPermission,
  type CardExportEstimate,
  type SafirCardExportItem,
} from '@safir/shared-types';
import type { CardExportOptionsInput } from '@safir/validation';
import { Readable } from 'node:stream';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';
import { cardRelations, type CardWithRelations } from '../cards/card.mapper.js';
import { stringifyCardsCsv } from './card-data-codec.js';

export interface CardExportStream {
  stream: Readable;
  fileName: string;
  contentType: string;
  operationId: string;
}

@Injectable()
export class CardDataExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async estimate(
    actor: AuthenticatedUser,
    options: CardExportOptionsInput,
  ): Promise<CardExportEstimate> {
    this.assertPermission(actor);
    const limit = this.config.get<number>('CARD_EXPORT_MAX_ROWS') ?? 50_000;
    const count = await this.prisma.card.count({ where: this.exportWhere(options) });
    return { count, limit };
  }

  async export(
    actor: AuthenticatedUser,
    options: CardExportOptionsInput,
    requestId: string,
  ): Promise<CardExportStream> {
    this.assertPermission(actor);
    const { count, limit } = await this.estimate(actor, options);
    if (count === 0) {
      throw new BadRequestException({
        code: 'CARD_EXPORT_NO_RESULTS',
        message: "Aucune carte ne correspond à l'export demandé.",
      });
    }
    if (count > limit) {
      throw new BadRequestException({
        code: 'CARD_EXPORT_TOO_LARGE',
        message: `Cet export contient ${count} cartes et dépasse la limite de ${limit}.`,
        details: { count, limit },
      });
    }

    const operation = await this.prisma.cardDataOperation.create({
      data: {
        actorUserId: actor.id,
        operationType: 'EXPORT',
        fileFormat: options.format,
        totalRows: count,
        filters: this.json(options),
        status: 'PROCESSING',
      },
    });
    const exportedAt = new Date().toISOString();
    const extension = options.format.toLowerCase();
    return {
      stream: Readable.from(
        this.generate(operation.id, actor.id, options, requestId, exportedAt, count, limit),
      ),
      fileName: `safir-cards-${exportedAt.slice(0, 10)}.${extension}`,
      contentType:
        options.format === 'JSON' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      operationId: operation.id,
    };
  }

  private async *generate(
    operationId: string,
    actorUserId: string,
    options: CardExportOptionsInput,
    requestId: string,
    exportedAt: string,
    expectedCount: number,
    limit: number,
  ): AsyncGenerator<string | Buffer> {
    let exportedCount = 0;
    let cursor: string | undefined;
    let first = true;
    let finalized = false;
    try {
      if (options.format === 'JSON') {
        yield `{"format":"safir-cards","version":1,"exportedAt":${JSON.stringify(exportedAt)},"cards":[`;
      } else {
        yield Buffer.from('\uFEFF', 'utf8');
      }

      while (true) {
        const cards = await this.prisma.card.findMany({
          where: this.exportWhere(options),
          include: cardRelations,
          orderBy: { id: 'asc' },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        if (!cards.length) break;
        if (exportedCount + cards.length > limit) {
          throw new Error('CARD_EXPORT_TOO_LARGE_DURING_STREAM');
        }
        const exported = cards.map((card) =>
          this.toExportItem(card, options.includeTechnicalMetadata),
        );
        if (options.format === 'JSON') {
          for (const card of exported) {
            yield `${first ? '' : ','}${JSON.stringify(card)}`;
            first = false;
          }
        } else {
          yield stringifyCardsCsv(exported, first);
          first = false;
        }
        exportedCount += cards.length;
        cursor = cards.at(-1)!.id;
      }
      if (options.format === 'JSON') yield ']}\n';

      const completedAt = new Date();
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.cardDataOperation.update({
          where: { id: operationId },
          data: {
            status: 'COMPLETED',
            totalRows: exportedCount,
            completedAt,
          },
        });
        await this.audit(transaction, actorUserId, operationId, 'CARDS_EXPORTED', requestId, {
          format: options.format,
          scope: options.scope,
          filters: options.filters ?? {},
          includeArchived: options.includeArchived,
          includeTechnicalMetadata: options.includeTechnicalMetadata,
          expectedCount,
          exportedCount,
        });
      });
      finalized = true;
    } catch {
      await this.markFailed(operationId, actorUserId, requestId);
      finalized = true;
      throw new InternalServerErrorException({
        code: 'CARD_EXPORT_GENERATION_FAILED',
        message: "Le fichier d'export n'a pas pu être généré.",
      });
    } finally {
      if (!finalized) await this.markFailed(operationId, actorUserId, requestId);
    }
  }

  private exportWhere(options: CardExportOptionsInput): Prisma.CardWhereInput {
    const filters = options.scope === 'FILTERED' ? options.filters : undefined;
    return {
      ...(options.scope === 'SELECTED' ? { id: { in: options.selectedCardIds } } : {}),
      ...(!options.includeArchived
        ? { deletedAt: null }
        : filters?.archived === 'active'
          ? { deletedAt: null }
          : filters?.archived === 'archived'
            ? { deletedAt: { not: null } }
            : {}),
      ...(filters?.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: 'insensitive' } },
              { description: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(filters?.seasonId ? { seasonId: filters.seasonId } : {}),
      ...(filters?.rarityId ? { rarityId: filters.rarityId } : {}),
      ...(filters?.typeId ? { typeLinks: { some: { typeId: filters.typeId } } } : {}),
      ...(filters?.isCommander !== undefined ? { isCommander: filters.isCommander } : {}),
      ...(filters?.status === 'active'
        ? { isActive: true }
        : filters?.status === 'inactive'
          ? { isActive: false }
          : {}),
    };
  }

  private toExportItem(card: CardWithRelations, includeTechnical: boolean): SafirCardExportItem {
    const metadata =
      card.metadata && typeof card.metadata === 'object' && !Array.isArray(card.metadata)
        ? (card.metadata as Record<string, unknown>)
        : {};
    return {
      name: card.name,
      number: Number(card.number),
      attack: Number(card.attack),
      defense: Number(card.defense),
      value: Number(card.value),
      description: card.description,
      imageUrl: card.imageUrl,
      isCommander: card.isCommander,
      rarity: { slug: card.rarity.slug, name: card.rarity.name },
      season: { slug: card.season.slug, name: card.season.name },
      types: card.typeLinks.map(({ type }) => ({ slug: type.slug, name: type.name })),
      isActive: card.isActive,
      metadata,
      ...(includeTechnical
        ? {
            _technical: {
              id: card.id,
              rarityId: card.rarityId,
              seasonId: card.seasonId,
            },
          }
        : {}),
    };
  }

  private assertPermission(actor: AuthenticatedUser): void {
    if (!hasPermission(actor.role, 'CARDS_EXPORT')) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: "Vous n'avez pas les permissions nécessaires pour cette action.",
      });
    }
  }

  private async markFailed(
    operationId: string,
    actorUserId: string,
    requestId: string,
  ): Promise<void> {
    try {
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.cardDataOperation.updateMany({
          where: { id: operationId, status: 'PROCESSING' },
          data: {
            status: 'FAILED',
            errorCount: 1,
            errorSummary: this.json([{ code: 'CARD_EXPORT_GENERATION_FAILED' }]),
            completedAt: new Date(),
          },
        });
        await this.audit(transaction, actorUserId, operationId, 'CARDS_EXPORT_FAILED', requestId, {
          code: 'CARD_EXPORT_GENERATION_FAILED',
        });
      });
    } catch {
      // The stream error remains the response reported to the caller.
    }
  }

  private audit(
    transaction: PrismaTransactionClient,
    actorUserId: string,
    operationId: string,
    action: string,
    requestId: string,
    afterData: unknown,
  ) {
    return transaction.adminAuditLog.create({
      data: {
        actorUserId,
        entityType: 'CARD_DATA_OPERATION',
        entityId: operationId,
        action,
        requestId,
        afterData: this.json(afterData),
      },
    });
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }
}
