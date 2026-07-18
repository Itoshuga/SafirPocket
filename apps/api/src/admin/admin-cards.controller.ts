import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  adminCardsQuerySchema,
  createCardSchema,
  idSchema,
  updateCardSchema,
} from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RequestId } from '../common/logging/request-id.decorator.js';
import { AdminCardsService } from './admin-cards.service.js';

@Permissions('CARDS_READ_ADMIN')
@Controller('api/v1/admin/cards')
export class AdminCardsController {
  constructor(private readonly cards: AdminCardsService) {}

  @Get()
  list(@Query() query: unknown) {
    return this.cards.list(parseInput(adminCardsQuerySchema, query));
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
