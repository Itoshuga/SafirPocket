import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  adminCardsQuerySchema,
  cardDataOperationsQuerySchema,
  cardExportOptionsSchema,
  cardImportExecuteSchema,
  cardImportFormatSchema,
  cardImportPreviewOptionsSchema,
  createCardSchema,
  idSchema,
  updateCardSchema,
} from '@safir/validation';
import type { Response } from 'express';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RequestId } from '../common/logging/request-id.decorator.js';
import { AdminCardsService } from './admin-cards.service.js';
import { cardImportTemplate } from './card-data-codec.js';
import { CardDataExportService } from './card-data-export.service.js';
import { CardDataImportService, type CardImportUpload } from './card-data-import.service.js';

@Permissions('CARDS_READ_ADMIN')
@Controller('api/v1/admin/cards')
export class AdminCardsController {
  constructor(
    private readonly cards: AdminCardsService,
    private readonly cardImports: CardDataImportService,
    private readonly cardExports: CardDataExportService,
  ) {}

  @Get()
  list(@Query() query: unknown) {
    return this.cards.list(parseInput(adminCardsQuerySchema, query));
  }

  @Permissions('CARDS_IMPORT')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20_000_000, files: 1 } }))
  @Post('import/preview')
  previewImport(
    @CurrentUser() actor: AuthenticatedUser,
    @UploadedFile() file: CardImportUpload | undefined,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'CARD_IMPORT_FILE_REQUIRED',
        message: 'Sélectionnez un fichier à importer.',
      });
    }
    return this.cardImports.preview(
      actor,
      file,
      parseInput(cardImportPreviewOptionsSchema, body),
      requestId,
    );
  }

  @Permissions('CARDS_IMPORT')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('import/execute')
  executeImport(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.cardImports.execute(actor, parseInput(cardImportExecuteSchema, body), requestId);
  }

  @Permissions('CARDS_IMPORT')
  @Get('import/template/:format')
  importTemplate(@Param('format') formatParam: string) {
    const format = parseInput(cardImportFormatSchema, formatParam.toUpperCase());
    const extension = format.toLowerCase();
    return new StreamableFile(cardImportTemplate(format), {
      type: format === 'JSON' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
      disposition: `attachment; filename="safir-cards-template.${extension}"`,
    });
  }

  @Permissions('CARDS_EXPORT')
  @Post('export/estimate')
  estimateExport(@CurrentUser() actor: AuthenticatedUser, @Body() body: unknown) {
    return this.cardExports.estimate(actor, parseInput(cardExportOptionsSchema, body));
  }

  @Permissions('CARDS_EXPORT')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('export')
  async exportCards(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
    @RequestId() requestId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.cardExports.export(
      actor,
      parseInput(cardExportOptionsSchema, body),
      requestId,
    );
    response.setHeader('X-Card-Data-Operation-Id', result.operationId);
    return new StreamableFile(result.stream, {
      type: result.contentType,
      disposition: `attachment; filename="${result.fileName}"`,
    });
  }

  @Get('data-operations')
  listDataOperations(@Query() query: unknown) {
    return this.cardImports.listOperations(parseInput(cardDataOperationsQuerySchema, query));
  }

  @Get('data-operations/:operationId/errors')
  getDataOperationErrors(@Param('operationId') operationId: string) {
    return this.cardImports.getOperationErrors(parseInput(idSchema, operationId));
  }

  @Get('data-operations/:operationId')
  getDataOperation(@Param('operationId') operationId: string) {
    return this.cardImports.getOperation(parseInput(idSchema, operationId));
  }

  @Get(':cardId')
  get(@Param('cardId') cardId: string) {
    return this.cards.get(parseInput(idSchema, cardId));
  }

  @Permissions('CARDS_CREATE')
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.cards.create(actor, parseInput(createCardSchema, body), requestId);
  }

  @Permissions('CARDS_UPDATE')
  @Patch(':cardId')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.cards.update(
      actor,
      parseInput(idSchema, cardId),
      parseInput(updateCardSchema, body),
      requestId,
    );
  }

  @Permissions('CARDS_ARCHIVE')
  @Delete(':cardId')
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @RequestId() requestId: string,
  ) {
    return this.cards.archive(actor, parseInput(idSchema, cardId), requestId);
  }

  @Permissions('CARDS_RESTORE')
  @Post(':cardId/restore')
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @RequestId() requestId: string,
  ) {
    return this.cards.restore(actor, parseInput(idSchema, cardId), requestId);
  }

  @Permissions('CARDS_DELETE_PERMANENTLY')
  @Delete(':cardId/permanent')
  permanentlyDelete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('cardId') cardId: string,
    @RequestId() requestId: string,
  ) {
    return this.cards.permanentlyDelete(actor, parseInput(idSchema, cardId), requestId);
  }
}
