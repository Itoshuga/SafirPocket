import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { deckCardSchema, deckCreateSchema, deckUpdateSchema, idSchema } from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { parseInput } from '../common/errors/zod.js';
import { DecksService } from './decks.service.js';

@Controller('api/v1/me/decks')
export class DecksController {
  constructor(private readonly decks: DecksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.decks.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.decks.create(user.id, parseInput(deckCreateSchema, body));
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.decks.getOwned(user.id, parseInput(idSchema, id));
  }

  @Patch(':id')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.decks.update(user.id, parseInput(idSchema, id), parseInput(deckUpdateSchema, body));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.decks.remove(user.id, parseInput(idSchema, id));
  }

  @Post(':id/cards')
  addCard(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.decks.addCard(user.id, parseInput(idSchema, id), parseInput(deckCardSchema, body));
  }

  @Delete(':id/cards/:cardVariantId')
  removeCard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('cardVariantId') cardVariantId: string,
  ) {
    return this.decks.removeCard(
      user.id,
      parseInput(idSchema, id),
      parseInput(idSchema, cardVariantId),
    );
  }
}
