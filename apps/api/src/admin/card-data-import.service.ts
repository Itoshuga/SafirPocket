import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  hasPermission,
  type AppPermission,
  type CardDataOperation,
  type CardImportError,
  type CardImportExecutionResult,
  type CardImportMissingRelation,
  type CardImportPreview,
  type CardImportPreviewRow,
  type CardImportPreviewSummary,
  type SafirCardRelationReference,
} from '@safir/shared-types';
import {
  safirCardImportItemSchema,
  type CardDataOperationsQuery,
  type CardImportExecuteInput,
  type CardImportPreviewOptions,
  type SafirCardImportItemInput,
} from '@safir/validation';
import { createHash } from 'node:crypto';
import { basename, extname } from 'node:path';
import type { ZodIssue } from 'zod';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';
import {
  CardDataCodecError,
  parseCardImport,
  type ParsedCardImportRow,
} from './card-data-codec.js';

export interface CardImportUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

type TaxonomyKind = 'rarity' | 'season' | 'type';

interface TaxonomyRecord {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  deletedAt: Date | null;
}

interface ResolvedRelation {
  id: string | null;
  name: string;
  slug: string;
  missing: boolean;
}

interface ResolvedPreviewRow {
  row: number;
  item: SafirCardImportItemInput;
  rarity: ResolvedRelation;
  season: ResolvedRelation;
  types: ResolvedRelation[];
  action: 'CREATE' | 'UPDATE' | 'SKIP';
  existingCardId: string | null;
  warnings: string[];
}

interface StoredPreviewPayload {
  options: CardImportPreviewOptions;
  canExecute: boolean;
  summary: CardImportPreviewSummary;
  rows: ResolvedPreviewRow[];
  missingRelations: CardImportPreview['missingRelations'];
}

interface MissingRelationAccumulator {
  name: string;
  slug: string;
  rows: Set<number>;
}

const taxonomyErrorCodes: Record<TaxonomyKind, string> = {
  rarity: 'RARITY_NOT_FOUND',
  season: 'SEASON_NOT_FOUND',
  type: 'CARD_TYPE_NOT_FOUND',
};

const taxonomyLabels: Record<TaxonomyKind, string> = {
  rarity: 'rareté',
  season: 'saison',
  type: 'type',
};

@Injectable()
export class CardDataImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async preview(
    actor: AuthenticatedUser,
    upload: CardImportUpload,
    options: CardImportPreviewOptions,
    requestId: string,
  ): Promise<CardImportPreview> {
    this.assertImportPermissions(actor, options);
    const maxBytes = this.config.get<number>('CARD_IMPORT_MAX_FILE_BYTES') ?? 5_242_880;
    const maxRows = this.config.get<number>('CARD_IMPORT_MAX_ROWS') ?? 5_000;
    const ttlSeconds = this.config.get<number>('CARD_IMPORT_PREVIEW_TTL_SECONDS') ?? 900;
    const fileName = this.safeFileName(upload.originalname);
    const fileHash = createHash('sha256').update(upload.buffer).digest('hex');

    try {
      this.assertUpload(upload, options.format, maxBytes);
      const parsedRows = parseCardImport(upload.buffer, options.format, maxRows);
      const analysis = await this.analyzeRows(parsedRows, options);
      const expiresAt = new Date(Date.now() + ttlSeconds * 1_000);
      const payload: StoredPreviewPayload = {
        options,
        canExecute: analysis.errors.length === 0,
        summary: analysis.summary,
        rows: analysis.resolvedRows,
        missingRelations: analysis.missingRelations,
      };
      const operation = await this.prisma.runInTransaction(async (transaction) => {
        const created = await transaction.cardDataOperation.create({
          data: {
            actorUserId: actor.id,
            operationType: 'IMPORT',
            fileFormat: options.format,
            importMode: options.mode,
            fileName,
            fileHash,
            totalRows: analysis.summary.totalRows,
            createdCount: analysis.summary.createCount,
            updatedCount: analysis.summary.updateCount,
            skippedCount: analysis.summary.skippedCount,
            errorCount: analysis.summary.errorCount,
            filters: this.json(options),
            status: 'PREVIEWED',
            errorSummary: this.json(analysis.errors),
            previewPayload: this.json(payload),
            expiresAt,
          },
        });
        await this.audit(transaction, actor.id, created.id, 'CARDS_IMPORT_PREVIEWED', requestId, {
          format: options.format,
          mode: options.mode,
          fileHash,
          summary: analysis.summary,
          createMissingRelations: options.createMissingRelations,
        });
        return created;
      });

      return {
        importPreviewId: operation.id,
        fileHash,
        fileName,
        format: options.format,
        mode: options.mode,
        expiresAt: expiresAt.toISOString(),
        canExecute: analysis.errors.length === 0,
        summary: analysis.summary,
        rows: analysis.previewRows,
        errors: analysis.errors,
        warnings: analysis.warnings,
        missingRelations: analysis.missingRelations,
      };
    } catch (error) {
      if (error instanceof CardDataCodecError) {
        await this.recordRejectedPreview(actor, fileName, fileHash, options, error, requestId);
        throw new BadRequestException({
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        });
      }
      throw error;
    }
  }

  async execute(
    actor: AuthenticatedUser,
    input: CardImportExecuteInput,
    requestId: string,
  ): Promise<CardImportExecutionResult> {
    const operation = await this.prisma.cardDataOperation.findUnique({
      where: { id: input.importPreviewId },
    });
    if (!operation || operation.operationType !== 'IMPORT' || operation.actorUserId !== actor.id) {
      throw new NotFoundException({
        code: 'CARD_IMPORT_PREVIEW_NOT_FOUND',
        message: "La prévisualisation d'import est introuvable.",
      });
    }
    if (operation.status !== 'PREVIEWED') {
      throw new ConflictException({
        code:
          operation.status === 'EXPIRED'
            ? 'CARD_IMPORT_PREVIEW_EXPIRED'
            : 'CARD_IMPORT_PREVIEW_ALREADY_USED',
        message:
          operation.status === 'EXPIRED'
            ? "La prévisualisation d'import a expiré."
            : "Cette prévisualisation d'import a déjà été utilisée.",
      });
    }
    if (!operation.expiresAt || operation.expiresAt <= new Date()) {
      await this.prisma.cardDataOperation.updateMany({
        where: { id: operation.id, status: 'PREVIEWED' },
        data: { status: 'EXPIRED', previewPayload: this.json(null) },
      });
      throw new GoneException({
        code: 'CARD_IMPORT_PREVIEW_EXPIRED',
        message: "La prévisualisation d'import a expiré.",
      });
    }
    if (operation.fileHash !== input.fileHash) {
      throw new ConflictException({
        code: 'CARD_IMPORT_FILE_CHANGED',
        message: 'Le fichier ne correspond plus à celui qui a été analysé.',
      });
    }
    const payload = this.readPayload(operation.previewPayload);
    this.assertImportPermissions(actor, payload.options);
    if (!payload.canExecute || payload.summary.errorCount > 0) {
      throw new ConflictException({
        code: 'CARD_IMPORT_VALIDATION_FAILED',
        message: "L'import contient encore des erreurs bloquantes.",
      });
    }

    try {
      return await this.prisma.runInTransaction(
        async (transaction) => {
          const claimed = await transaction.cardDataOperation.updateMany({
            where: { id: operation.id, actorUserId: actor.id, status: 'PREVIEWED' },
            data: { status: 'PROCESSING' },
          });
          if (claimed.count !== 1) {
            throw new ConflictException({
              code: 'CARD_IMPORT_PREVIEW_ALREADY_USED',
              message: "Cette prévisualisation d'import a déjà été utilisée.",
            });
          }

          const createdRelations = await this.createMissingRelations(
            transaction,
            actor,
            payload,
            requestId,
          );
          const relationMaps = await this.loadActiveTaxonomies(transaction, true);
          const importedCardIds: string[] = [];

          for (const row of payload.rows) {
            if (row.action === 'SKIP') continue;
            const itemResult = safirCardImportItemSchema.safeParse(row.item);
            if (!itemResult.success) {
              throw new ConflictException({
                code: 'CARD_IMPORT_FILE_CHANGED',
                message: 'Les données validées ne sont plus cohérentes.',
              });
            }
            const item = itemResult.data;
            const rarity = this.requireStoredRelation(row.rarity, relationMaps.rarity, 'rarity');
            const season = this.requireStoredRelation(row.season, relationMaps.season, 'season');
            const types = row.types.map((relation) =>
              this.requireStoredRelation(relation, relationMaps.type, 'type'),
            );
            const existing = await transaction.card.findFirst({
              where: { seasonId: season.id, number: BigInt(item.number) },
            });

            if (row.action === 'CREATE') {
              if (existing) this.concurrentConflict(row.row);
              const card = await transaction.card.create({
                data: this.cardCreateData(
                  item,
                  rarity,
                  season,
                  types,
                  row.rarity.missing ||
                    row.season.missing ||
                    row.types.some(({ missing }) => missing),
                ),
              });
              await this.audit(
                transaction,
                actor.id,
                card.id,
                'CARD_IMPORTED_CREATED',
                requestId,
                {
                  sourceRow: row.row,
                  operationId: operation.id,
                  name: item.name,
                  number: item.number,
                },
                'CARD',
              );
              importedCardIds.push(card.id);
              continue;
            }

            if (!existing || existing.id !== row.existingCardId || existing.deletedAt) {
              this.concurrentConflict(row.row);
            }
            await transaction.cardTypeLink.deleteMany({ where: { cardId: existing.id } });
            await transaction.cardTypeLink.createMany({
              data: types.map((type, sortOrder) => ({
                cardId: existing.id,
                typeId: type.id,
                sortOrder,
              })),
            });
            const forceInactive =
              row.rarity.missing || row.season.missing || row.types.some(({ missing }) => missing);
            await transaction.card.update({
              where: { id: existing.id },
              data: this.cardUpdateData(item, rarity, season, types, forceInactive),
            });
            const variants = await transaction.cardVariant.updateMany({
              where: { cardId: existing.id, slug: 'standard' },
              data: { artworkPath: item.imageUrl ?? null },
            });
            if (variants.count === 0) {
              await transaction.cardVariant.create({
                data: {
                  cardId: existing.id,
                  name: 'Standard',
                  slug: 'standard',
                  finish: 'standard',
                  artworkPath: item.imageUrl ?? null,
                  displayOrder: 0,
                },
              });
            }
            await this.audit(
              transaction,
              actor.id,
              existing.id,
              'CARD_IMPORTED_UPDATED',
              requestId,
              {
                sourceRow: row.row,
                operationId: operation.id,
                name: item.name,
                number: item.number,
              },
              'CARD',
            );
            importedCardIds.push(existing.id);
          }

          const completedAt = new Date();
          await transaction.cardDataOperation.update({
            where: { id: operation.id },
            data: {
              status: 'COMPLETED',
              completedAt,
              previewPayload: this.json(null),
              createdCount: payload.summary.createCount,
              updatedCount: payload.summary.updateCount,
              skippedCount: payload.summary.skippedCount,
              errorCount: 0,
              errorSummary: this.json([]),
            },
          });
          await this.audit(transaction, actor.id, operation.id, 'CARDS_IMPORTED', requestId, {
            format: payload.options.format,
            mode: payload.options.mode,
            fileHash: operation.fileHash,
            summary: payload.summary,
            createdRelations,
          });
          return {
            operationId: operation.id,
            status: 'COMPLETED',
            summary: payload.summary,
            importedCardIds,
            createdRelations,
            completedAt: completedAt.toISOString(),
          };
        },
        { isolationLevel: 'Serializable', maxWait: 10_000, timeout: 120_000 },
      );
    } catch (error) {
      if (this.errorCode(error) !== 'CARD_IMPORT_PREVIEW_ALREADY_USED') {
        await this.markFailed(operation.id, actor.id, requestId, error);
      }
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException({
        code: 'CARD_IMPORT_TRANSACTION_FAILED',
        message: "L'import a échoué. Aucune carte n'a été modifiée.",
      });
    }
  }

  async listOperations(query: CardDataOperationsQuery) {
    await this.expireOldPreviews();
    const where: Prisma.CardDataOperationWhereInput = {
      ...(query.operationType ? { operationType: query.operationType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [operations, total] = await this.prisma.$transaction([
      this.prisma.cardDataOperation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.cardDataOperation.count({ where }),
    ]);
    return {
      data: operations.map((operation) => this.toOperation(operation)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getOperation(operationId: string): Promise<CardDataOperation> {
    await this.expireOldPreviews();
    const operation = await this.prisma.cardDataOperation.findUnique({
      where: { id: operationId },
    });
    if (!operation) this.operationNotFound();
    return this.toOperation(operation);
  }

  async getOperationErrors(operationId: string): Promise<{ errors: CardImportError[] }> {
    await this.expireOldPreviews();
    const operation = await this.prisma.cardDataOperation.findUnique({
      where: { id: operationId },
    });
    if (!operation) this.operationNotFound();
    return {
      errors: Array.isArray(operation.errorSummary)
        ? (operation.errorSummary as unknown as CardImportError[])
        : [],
    };
  }

  private async analyzeRows(parsedRows: ParsedCardImportRow[], options: CardImportPreviewOptions) {
    const maps = await this.loadActiveTaxonomies(this.prisma, false);
    const missing = {
      rarity: new Map<string, MissingRelationAccumulator>(),
      season: new Map<string, MissingRelationAccumulator>(),
      type: new Map<string, MissingRelationAccumulator>(),
    };
    const analyzed = parsedRows.map((parsed) => {
      const errors = [...parsed.errors];
      const validated = safirCardImportItemSchema.safeParse(parsed.value);
      if (!validated.success) {
        errors.push(...validated.error.issues.map((issue) => this.zodError(parsed, issue)));
        return { parsed, errors, item: null, rarity: null, season: null, types: [], warnings: [] };
      }
      const item = validated.data;
      const rarity = this.resolveRelation(
        item.rarity,
        'rarity',
        parsed.row,
        item.name,
        maps.rarity,
        options.createMissingRelations,
        missing.rarity,
        errors,
      );
      const season = this.resolveRelation(
        item.season,
        'season',
        parsed.row,
        item.name,
        maps.season,
        options.createMissingRelations,
        missing.season,
        errors,
      );
      const types = item.types
        .map((reference) =>
          this.resolveRelation(
            reference,
            'type',
            parsed.row,
            item.name,
            maps.type,
            options.createMissingRelations,
            missing.type,
            errors,
          ),
        )
        .filter((relation): relation is ResolvedRelation => Boolean(relation));
      return {
        parsed,
        errors,
        item,
        rarity,
        season,
        types,
        warnings: this.imageWarnings(item.imageUrl),
      };
    });

    this.addMissingDefinitionConflicts(analyzed, missing);
    const duplicateGroups = new Map<string, typeof analyzed>();
    for (const row of analyzed) {
      if (!row.item || !row.season) continue;
      const key = `${row.season.slug}:${row.item.number}`;
      const group = duplicateGroups.get(key) ?? [];
      group.push(row);
      duplicateGroups.set(key, group);
    }
    for (const group of duplicateGroups.values()) {
      if (group.length < 2) continue;
      const occurrences = group.map(({ parsed }) => parsed.row);
      for (const row of group) {
        row.errors.push({
          row: row.parsed.row,
          cardName: row.item?.name,
          field: 'number',
          value: row.item?.number,
          code: 'CARD_IMPORT_DUPLICATE_ROWS',
          message: `Les lignes ${occurrences.join(', ')} utilisent la même saison et le même numéro.`,
        });
      }
    }

    const seasonNumbers = new Map<string, Set<number>>();
    for (const row of analyzed) {
      if (!row.item || !row.season?.id) continue;
      const numbers = seasonNumbers.get(row.season.id) ?? new Set<number>();
      numbers.add(row.item.number);
      seasonNumbers.set(row.season.id, numbers);
    }
    const existingCards = seasonNumbers.size
      ? await this.prisma.card.findMany({
          where: {
            OR: [...seasonNumbers].map(([seasonId, numbers]) => ({
              seasonId,
              number: { in: [...numbers].map(BigInt) },
            })),
          },
          select: { id: true, seasonId: true, number: true, deletedAt: true },
        })
      : [];
    const existingByKey = new Map(
      existingCards.map((card) => [`${card.seasonId}:${card.number.toString()}`, card]),
    );

    const previewRows: CardImportPreviewRow[] = [];
    const resolvedRows: ResolvedPreviewRow[] = [];
    const allErrors: CardImportError[] = [];
    const allWarnings: string[] = [];
    for (const row of analyzed) {
      let action: CardImportPreviewRow['action'] = 'ERROR';
      let existingCardId: string | undefined;
      if (!row.errors.length && row.item && row.rarity && row.season && row.types.length) {
        const existing = row.season.id
          ? existingByKey.get(`${row.season.id}:${row.item.number}`)
          : undefined;
        existingCardId = existing?.id;
        if (existing?.deletedAt) {
          row.errors.push({
            row: row.parsed.row,
            cardName: row.item.name,
            field: 'number',
            value: row.item.number,
            code: 'CARD_IMPORT_CONFLICT',
            message: 'Une carte archivée utilise déjà ce numéro dans cette saison.',
          });
        } else if (options.mode === 'CREATE_ONLY' && existing) {
          action = options.conflictBehavior === 'SKIP' ? 'SKIP' : 'ERROR';
          if (action === 'ERROR') row.errors.push(this.existingConflict(row, 'existe déjà'));
        } else if (options.mode === 'UPDATE_ONLY' && !existing) {
          action = options.conflictBehavior === 'SKIP' ? 'SKIP' : 'ERROR';
          if (action === 'ERROR') row.errors.push(this.existingConflict(row, "n'existe pas"));
        } else if (options.mode === 'UPDATE_ONLY' || (options.mode === 'UPSERT' && existing)) {
          action = 'UPDATE';
        } else {
          action = 'CREATE';
        }
      }
      if (row.errors.length) action = 'ERROR';
      allErrors.push(...row.errors);
      allWarnings.push(...row.warnings.map((warning) => `Ligne ${row.parsed.row} : ${warning}`));
      previewRows.push({
        row: row.parsed.row,
        name: row.item?.name ?? this.rawCardName(row.parsed.value),
        action,
        ...(existingCardId ? { existingCardId } : {}),
        errors: row.errors,
        warnings: row.warnings,
      });
      if (action !== 'ERROR' && row.item && row.rarity && row.season && row.types.length) {
        resolvedRows.push({
          row: row.parsed.row,
          item: row.item,
          rarity: row.rarity,
          season: row.season,
          types: row.types,
          action,
          existingCardId: existingCardId ?? null,
          warnings: row.warnings,
        });
      }
    }
    const errorCount = previewRows.filter(({ action }) => action === 'ERROR').length;
    const summary: CardImportPreviewSummary = {
      totalRows: previewRows.length,
      validRows: previewRows.length - errorCount,
      createCount: previewRows.filter(({ action }) => action === 'CREATE').length,
      updateCount: previewRows.filter(({ action }) => action === 'UPDATE').length,
      skippedCount: previewRows.filter(({ action }) => action === 'SKIP').length,
      errorCount,
    };
    return {
      previewRows,
      resolvedRows,
      errors: allErrors,
      warnings: [...new Set(allWarnings)],
      missingRelations: {
        rarities: this.serializeMissing(missing.rarity),
        seasons: this.serializeMissing(missing.season),
        types: this.serializeMissing(missing.type),
      },
      summary,
    };
  }

  private resolveRelation(
    reference: SafirCardRelationReference,
    kind: TaxonomyKind,
    row: number,
    cardName: string,
    maps: ReturnType<CardDataImportService['taxonomyMaps']>,
    createMissing: boolean,
    missing: Map<string, MissingRelationAccumulator>,
    errors: CardImportError[],
  ): ResolvedRelation | null {
    const bySlug = reference.slug ? maps.bySlug.get(reference.slug.toLowerCase()) : undefined;
    const byName =
      !reference.slug && reference.name ? maps.byName.get(this.nameKey(reference.name)) : [];
    const record = bySlug ?? (byName?.length === 1 ? byName[0] : undefined);
    if (record?.isActive && !record.deletedAt) {
      return { id: record.id, name: record.name, slug: record.slug, missing: false };
    }
    if (!reference.slug && (byName?.length ?? 0) > 1) {
      errors.push({
        row,
        cardName,
        field: kind,
        value: reference.name,
        code: 'CARD_IMPORT_RELATION_AMBIGUOUS',
        message: `Plusieurs ${taxonomyLabels[kind]}s correspondent à ce nom. Utilisez un slug.`,
      });
      return null;
    }
    const unavailable =
      (reference.slug ? maps.allBySlug.get(reference.slug.toLowerCase()) : undefined) ??
      (!reference.slug && reference.name
        ? maps.allByName.get(this.nameKey(reference.name))?.[0]
        : undefined);
    if (unavailable) {
      errors.push({
        row,
        cardName,
        field: kind,
        value: reference.slug ?? reference.name,
        code: taxonomyErrorCodes[kind],
        message: `La ${taxonomyLabels[kind]} demandée est inactive ou archivée.`,
      });
      return null;
    }
    if (createMissing && reference.slug && reference.name) {
      const current = missing.get(reference.slug);
      if (current) current.rows.add(row);
      else
        missing.set(reference.slug, {
          slug: reference.slug,
          name: reference.name,
          rows: new Set([row]),
        });
      return { id: null, slug: reference.slug, name: reference.name, missing: true };
    }
    errors.push({
      row,
      cardName,
      field: kind,
      value: reference.slug ?? reference.name,
      code: taxonomyErrorCodes[kind],
      message: `La ${taxonomyLabels[kind]} « ${reference.slug ?? reference.name} » n'existe pas.`,
    });
    return null;
  }

  private addMissingDefinitionConflicts(
    rows: Array<{
      parsed: ParsedCardImportRow;
      item: SafirCardImportItemInput | null;
      errors: CardImportError[];
    }>,
    missing: Record<TaxonomyKind, Map<string, MissingRelationAccumulator>>,
  ): void {
    for (const [kind, definitions] of Object.entries(missing) as Array<
      [TaxonomyKind, Map<string, MissingRelationAccumulator>]
    >) {
      for (const definition of definitions.values()) {
        const names = new Set<string>();
        for (const row of rows) {
          if (!row.item || !definition.rows.has(row.parsed.row)) continue;
          const references =
            kind === 'type'
              ? row.item.types
              : [kind === 'rarity' ? row.item.rarity : row.item.season];
          for (const reference of references) {
            if (reference.slug === definition.slug && reference.name)
              names.add(this.nameKey(reference.name));
          }
        }
        if (names.size <= 1) continue;
        for (const rowNumber of definition.rows) {
          const row = rows.find(({ parsed }) => parsed.row === rowNumber);
          row?.errors.push({
            row: rowNumber,
            cardName: row.item?.name,
            field: kind,
            value: definition.slug,
            code: 'CARD_IMPORT_RELATION_CONFLICT',
            message: `Le slug « ${definition.slug} » est associé à plusieurs noms dans le fichier.`,
          });
        }
      }
    }
  }

  private async createMissingRelations(
    transaction: PrismaTransactionClient,
    actor: AuthenticatedUser,
    payload: StoredPreviewPayload,
    requestId: string,
  ) {
    const counts = { rarities: 0, seasons: 0, types: 0 };
    if (!payload.options.createMissingRelations) return counts;
    for (const relation of payload.missingRelations.rarities) {
      const created = await transaction.cardRarity.create({
        data: { name: relation.name, slug: relation.slug, isActive: false, sortOrder: 0 },
      });
      counts.rarities += 1;
      await this.audit(
        transaction,
        actor.id,
        created.id,
        'CARD_IMPORT_RELATION_CREATED',
        requestId,
        {
          entityType: 'CARD_RARITY',
          name: created.name,
          slug: created.slug,
          isActive: false,
        },
        'CARD_RARITY',
      );
    }
    for (const relation of payload.missingRelations.seasons) {
      const created = await transaction.cardSeason.create({
        data: { name: relation.name, slug: relation.slug, isActive: false, sortOrder: 0 },
      });
      counts.seasons += 1;
      await this.audit(
        transaction,
        actor.id,
        created.id,
        'CARD_IMPORT_RELATION_CREATED',
        requestId,
        {
          entityType: 'CARD_SEASON',
          name: created.name,
          slug: created.slug,
          isActive: false,
        },
        'CARD_SEASON',
      );
    }
    for (const relation of payload.missingRelations.types) {
      const created = await transaction.cardType.create({
        data: { name: relation.name, slug: relation.slug, isActive: false, sortOrder: 0 },
      });
      counts.types += 1;
      await this.audit(
        transaction,
        actor.id,
        created.id,
        'CARD_IMPORT_RELATION_CREATED',
        requestId,
        {
          entityType: 'CARD_TYPE',
          name: created.name,
          slug: created.slug,
          isActive: false,
        },
        'CARD_TYPE',
      );
    }
    return counts;
  }

  private cardCreateData(
    item: SafirCardImportItemInput,
    rarity: TaxonomyRecord,
    season: TaxonomyRecord,
    types: TaxonomyRecord[],
    forceInactive: boolean,
  ): Prisma.CardCreateInput {
    const isActive = forceInactive ? false : item.isActive;
    return {
      name: item.name,
      slug: this.cardSlug(item.name, item.number),
      collectionNumber: String(item.number),
      legacyRarity: rarity.name,
      legacyCardType: types[0]!.name,
      cost: item.value,
      stats: { attack: item.attack, defense: item.defense },
      metadata: this.cardMetadata(item),
      artworkPath: item.imageUrl ?? null,
      status: isActive ? 'published' : 'draft',
      number: BigInt(item.number),
      attack: BigInt(item.attack),
      defense: BigInt(item.defense),
      value: BigInt(item.value),
      description: item.description ?? null,
      imageUrl: item.imageUrl ?? null,
      isCommander: item.isCommander,
      isActive,
      rarity: { connect: { id: rarity.id } },
      season: { connect: { id: season.id } },
      typeLinks: {
        create: types.map((type, sortOrder) => ({ type: { connect: { id: type.id } }, sortOrder })),
      },
      variants: {
        create: {
          name: 'Standard',
          slug: 'standard',
          finish: 'standard',
          artworkPath: item.imageUrl ?? null,
          displayOrder: 0,
        },
      },
    };
  }

  private cardUpdateData(
    item: SafirCardImportItemInput,
    rarity: TaxonomyRecord,
    season: TaxonomyRecord,
    types: TaxonomyRecord[],
    forceInactive: boolean,
  ): Prisma.CardUpdateInput {
    const isActive = forceInactive ? false : item.isActive;
    return {
      name: item.name,
      slug: this.cardSlug(item.name, item.number),
      collectionNumber: String(item.number),
      legacyRarity: rarity.name,
      legacyCardType: types[0]!.name,
      cost: item.value,
      stats: { attack: item.attack, defense: item.defense },
      metadata: this.cardMetadata(item),
      artworkPath: item.imageUrl ?? null,
      status: isActive ? 'published' : 'draft',
      number: BigInt(item.number),
      attack: BigInt(item.attack),
      defense: BigInt(item.defense),
      value: BigInt(item.value),
      description: item.description ?? null,
      imageUrl: item.imageUrl ?? null,
      isCommander: item.isCommander,
      isActive,
      rarity: { connect: { id: rarity.id } },
      season: { connect: { id: season.id } },
    };
  }

  private async loadActiveTaxonomies(
    client: PrismaService | PrismaTransactionClient,
    includeCreatedInactive: boolean,
  ) {
    const [rarities, seasons, types] = await Promise.all([
      client.cardRarity.findMany(),
      client.cardSeason.findMany(),
      client.cardType.findMany(),
    ]);
    return {
      rarity: this.taxonomyMaps(rarities, includeCreatedInactive),
      season: this.taxonomyMaps(seasons, includeCreatedInactive),
      type: this.taxonomyMaps(types, includeCreatedInactive),
    };
  }

  private taxonomyMaps(records: TaxonomyRecord[], includeInactive: boolean) {
    const active = records.filter(
      (record) => !record.deletedAt && (record.isActive || includeInactive),
    );
    return {
      bySlug: new Map(active.map((record) => [record.slug.toLowerCase(), record])),
      byName: this.groupByName(active),
      allBySlug: new Map(records.map((record) => [record.slug.toLowerCase(), record])),
      allByName: this.groupByName(records),
    };
  }

  private groupByName(records: TaxonomyRecord[]): Map<string, TaxonomyRecord[]> {
    const grouped = new Map<string, TaxonomyRecord[]>();
    for (const record of records) {
      const key = this.nameKey(record.name);
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    }
    return grouped;
  }

  private requireStoredRelation(
    stored: ResolvedRelation,
    maps: ReturnType<CardDataImportService['taxonomyMaps']>,
    kind: TaxonomyKind,
  ): TaxonomyRecord {
    const relation = maps.bySlug.get(stored.slug.toLowerCase());
    if (!relation || relation.deletedAt) {
      throw new ConflictException({
        code: 'CARD_IMPORT_RELATION_NOT_FOUND',
        message: `La ${taxonomyLabels[kind]} « ${stored.slug} » n'est plus disponible.`,
      });
    }
    if (!stored.missing && !relation.isActive) {
      throw new ConflictException({
        code: 'CARD_IMPORT_RELATION_NOT_FOUND',
        message: `La ${taxonomyLabels[kind]} « ${stored.slug} » a été désactivée depuis la prévisualisation.`,
      });
    }
    return relation;
  }

  private zodError(parsed: ParsedCardImportRow, issue: ZodIssue): CardImportError {
    const field = issue.path.join('.') || 'card';
    return {
      row: parsed.row,
      cardName: this.rawCardName(parsed.value),
      field,
      value: this.valueAtPath(parsed.value, issue.path),
      code: 'CARD_IMPORT_VALIDATION_FAILED',
      message: issue.message,
    };
  }

  private existingConflict(
    row: { parsed: ParsedCardImportRow; item: SafirCardImportItemInput | null },
    state: string,
  ): CardImportError {
    return {
      row: row.parsed.row,
      cardName: row.item?.name,
      field: 'number',
      value: row.item?.number,
      code: 'CARD_IMPORT_CONFLICT',
      message: `Cette carte ${state} dans cette saison.`,
    };
  }

  private concurrentConflict(row: number): never {
    throw new ConflictException({
      code: 'CARD_IMPORT_CONFLICT',
      message: `Les données ont changé depuis la prévisualisation (ligne ${row}). Relancez l'analyse.`,
    });
  }

  private assertUpload(upload: CardImportUpload, format: 'JSON' | 'CSV', maxBytes: number): void {
    if (!upload.buffer?.length) {
      throw new CardDataCodecError(
        'CARD_IMPORT_FILE_REQUIRED',
        'Sélectionnez un fichier à importer.',
      );
    }
    if (upload.size > maxBytes || upload.buffer.length > maxBytes) {
      throw new CardDataCodecError(
        'CARD_IMPORT_FILE_TOO_LARGE',
        `Le fichier dépasse la limite de ${Math.floor(maxBytes / 1_048_576)} Mo.`,
        { maxBytes },
      );
    }
    const extension = extname(upload.originalname).toLowerCase();
    const expectedExtension = format === 'JSON' ? '.json' : '.csv';
    if (extension && extension !== expectedExtension) {
      throw new CardDataCodecError(
        'CARD_IMPORT_FORMAT_UNSUPPORTED',
        `L'extension du fichier ne correspond pas au format ${format}.`,
      );
    }
    const mime = upload.mimetype.toLowerCase();
    const incompatibleMime =
      (format === 'JSON' && mime.includes('csv')) ||
      (format === 'CSV' && (mime.includes('json') || mime === 'application/javascript'));
    if (incompatibleMime) {
      throw new CardDataCodecError(
        'CARD_IMPORT_FORMAT_UNSUPPORTED',
        `Le type du fichier ne correspond pas au format ${format}.`,
      );
    }
    const first = upload.buffer
      .toString('utf8')
      .replace(/^\uFEFF/, '')
      .trimStart()[0];
    if (format === 'JSON' && first !== '{' && first !== '[') {
      throw new CardDataCodecError(
        'CARD_IMPORT_INVALID_JSON',
        'Le contenu ne ressemble pas à du JSON.',
      );
    }
  }

  private assertImportPermissions(
    actor: AuthenticatedUser,
    options: CardImportPreviewOptions,
  ): void {
    this.assertPermission(actor, 'CARDS_IMPORT');
    if (options.mode !== 'UPDATE_ONLY') this.assertPermission(actor, 'CARDS_CREATE');
    if (options.mode !== 'CREATE_ONLY') this.assertPermission(actor, 'CARDS_UPDATE');
    if (options.createMissingRelations) {
      this.assertPermission(actor, 'CARDS_IMPORT_CREATE_RELATIONS');
    }
  }

  private assertPermission(actor: AuthenticatedUser, permission: AppPermission): void {
    if (!hasPermission(actor.role, permission)) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: "Vous n'avez pas les permissions nécessaires pour cette action.",
      });
    }
  }

  private async recordRejectedPreview(
    actor: AuthenticatedUser,
    fileName: string,
    fileHash: string,
    options: CardImportPreviewOptions,
    error: CardDataCodecError,
    requestId: string,
  ): Promise<void> {
    await this.prisma.runInTransaction(async (transaction) => {
      const operation = await transaction.cardDataOperation.create({
        data: {
          actorUserId: actor.id,
          operationType: 'IMPORT',
          fileFormat: options.format,
          importMode: options.mode,
          fileName,
          fileHash,
          filters: this.json(options),
          status: 'FAILED',
          errorCount: 1,
          errorSummary: this.json([
            { code: error.code, message: error.message, details: error.details },
          ]),
          completedAt: new Date(),
        },
      });
      await this.audit(transaction, actor.id, operation.id, 'CARDS_IMPORT_FAILED', requestId, {
        format: options.format,
        mode: options.mode,
        fileHash,
        code: error.code,
      });
    });
  }

  private async markFailed(
    operationId: string,
    actorUserId: string,
    requestId: string,
    error: unknown,
  ): Promise<void> {
    const code = this.errorCode(error) ?? 'CARD_IMPORT_TRANSACTION_FAILED';
    try {
      await this.prisma.runInTransaction(async (transaction) => {
        await transaction.cardDataOperation.updateMany({
          where: { id: operationId, status: { in: ['PREVIEWED', 'PROCESSING'] } },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            previewPayload: this.json(null),
            errorCount: 1,
            errorSummary: this.json([{ code }]),
          },
        });
        await this.audit(transaction, actorUserId, operationId, 'CARDS_IMPORT_FAILED', requestId, {
          code,
        });
      });
    } catch {
      // The original transaction error remains the actionable response.
    }
  }

  private errorCode(error: unknown): string | undefined {
    if (!(error instanceof HttpException)) return undefined;
    const response = error.getResponse();
    if (response && typeof response === 'object' && 'code' in response) {
      return String((response as { code?: unknown }).code);
    }
    return undefined;
  }

  private async expireOldPreviews(): Promise<void> {
    await this.prisma.cardDataOperation.updateMany({
      where: { status: 'PREVIEWED', expiresAt: { lte: new Date() } },
      data: { status: 'EXPIRED', previewPayload: this.json(null) },
    });
  }

  private readPayload(value: Prisma.JsonValue | null): StoredPreviewPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new NotFoundException({
        code: 'CARD_IMPORT_PREVIEW_NOT_FOUND',
        message: 'Les données de prévisualisation sont introuvables.',
      });
    }
    return value as unknown as StoredPreviewPayload;
  }

  private toOperation(operation: {
    id: string;
    operationType: string;
    fileFormat: string;
    importMode: string | null;
    fileName: string | null;
    fileHash: string | null;
    totalRows: number;
    createdCount: number;
    updatedCount: number;
    skippedCount: number;
    errorCount: number;
    filters: Prisma.JsonValue;
    status: string;
    expiresAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
  }): CardDataOperation {
    return {
      id: operation.id,
      operationType: operation.operationType as CardDataOperation['operationType'],
      fileFormat: operation.fileFormat as CardDataOperation['fileFormat'],
      importMode: operation.importMode as CardDataOperation['importMode'],
      fileName: operation.fileName,
      fileHash: operation.fileHash,
      totalRows: operation.totalRows,
      createdCount: operation.createdCount,
      updatedCount: operation.updatedCount,
      skippedCount: operation.skippedCount,
      errorCount: operation.errorCount,
      filters:
        operation.filters &&
        typeof operation.filters === 'object' &&
        !Array.isArray(operation.filters)
          ? (operation.filters as Record<string, unknown>)
          : {},
      status: operation.status as CardDataOperation['status'],
      expiresAt: operation.expiresAt?.toISOString() ?? null,
      completedAt: operation.completedAt?.toISOString() ?? null,
      createdAt: operation.createdAt.toISOString(),
    };
  }

  private audit(
    transaction: PrismaTransactionClient,
    actorUserId: string,
    entityId: string,
    action: string,
    requestId: string,
    afterData: unknown,
    entityType = 'CARD_DATA_OPERATION',
  ) {
    return transaction.adminAuditLog.create({
      data: {
        actorUserId,
        entityType,
        entityId,
        action,
        requestId,
        afterData: this.json(afterData),
      },
    });
  }

  private serializeMissing(
    values: Map<string, MissingRelationAccumulator>,
  ): CardImportMissingRelation[] {
    return [...values.values()]
      .map(({ slug, name, rows }) => ({ slug, name, rows: [...rows].sort((a, b) => a - b) }))
      .sort((a, b) => a.slug.localeCompare(b.slug));
  }

  private imageWarnings(imageUrl: string | null | undefined): string[] {
    if (!imageUrl) return [];
    const hostname = new URL(imageUrl).hostname.toLowerCase();
    const familiar =
      hostname === 'firebasestorage.googleapis.com' ||
      hostname.endsWith('.supabase.co') ||
      hostname.endsWith('.supabase.net');
    return familiar
      ? []
      : ["Le domaine de l'image est inhabituel ; l'URL sera conservée sans téléchargement."];
  }

  private rawCardName(value: unknown): string {
    if (value && typeof value === 'object' && 'name' in value) {
      const name = (value as { name?: unknown }).name;
      if (typeof name === 'string') return name;
    }
    return 'Carte sans nom';
  }

  private valueAtPath(value: unknown, path: PropertyKey[]): unknown {
    let current = value;
    for (const key of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<PropertyKey, unknown>)[key];
    }
    return current;
  }

  private safeFileName(value: string): string {
    return basename(value || 'cartes')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 255);
  }

  private nameKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('fr');
  }

  private cardSlug(name: string, number: number): string {
    const base = this.nameKey(name)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100);
    return `${base || 'carte'}-${number}`;
  }

  private cardMetadata(item: SafirCardImportItemInput): Prisma.InputJsonObject {
    return { ...(item.metadata ?? {}), isCommander: item.isCommander } as Prisma.InputJsonObject;
  }

  private json(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private operationNotFound(): never {
    throw new NotFoundException({
      code: 'CARD_DATA_OPERATION_NOT_FOUND',
      message: 'Opération introuvable.',
    });
  }
}
