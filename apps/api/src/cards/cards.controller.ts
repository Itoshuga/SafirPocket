import { Controller, Get, Param, Query } from '@nestjs/common';
import { cardFiltersSchema, idSchema } from '@safir/validation';
import { Public } from '../common/auth/public.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { CardsService } from './cards.service.js';

@Public()
@Controller('api/v1')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  @Get('card-sets')
  listSets() {
    return this.cards.listSets();
  }

  @Get('card-sets/:slug')
  getSet(@Param('slug') slug: string) {
    return this.cards.getSet(slug);
  }

  @Get('cards')
  listCards(@Query() query: unknown) {
    return this.cards.listCards(parseInput(cardFiltersSchema, query));
  }

  @Get('card-facets')
  facets() {
    return this.cards.facets();
  }

  @Get('cards/:id')
  getCard(@Param('id') id: string) {
    return this.cards.getCard(parseInput(idSchema, id));
  }
}
