import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import {
  adminBoostersQuerySchema,
  createBoosterSchema,
  idSchema,
  updateBoosterDropRatesSchema,
  updateBoosterSchema,
} from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RequestId } from '../common/logging/request-id.decorator.js';
import { AdminBoostersService } from './admin-boosters.service.js';

@Permissions('BOOSTERS_READ_ADMIN')
@Controller('api/v1/admin/boosters')
export class AdminBoostersController {
  constructor(private readonly boosters: AdminBoostersService) {}

  @Get() list(@Query() query: unknown) {
    return this.boosters.list(parseInput(adminBoostersQuerySchema, query));
  }

  @Get(':id') get(@Param('id') id: string) {
    return this.boosters.get(parseInput(idSchema, id));
  }

  @Permissions('BOOSTERS_CREATE')
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.boosters.create(actor, parseInput(createBoosterSchema, body), requestId);
  }

  @Permissions('BOOSTERS_UPDATE')
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.boosters.update(
      actor,
      parseInput(idSchema, id),
      parseInput(updateBoosterSchema, body),
      requestId,
    );
  }

  @Permissions('BOOSTERS_CREATE')
  @Post(':id/duplicate')
  duplicate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.duplicate(actor, parseInput(idSchema, id), requestId);
  }

  @Permissions('BOOSTERS_UPDATE')
  @Post(':id/activate')
  activate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.activate(actor, parseInput(idSchema, id), requestId);
  }

  @Permissions('BOOSTERS_UPDATE')
  @Post(':id/deactivate')
  deactivate(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.deactivate(actor, parseInput(idSchema, id), requestId);
  }

  @Permissions('BOOSTERS_ARCHIVE')
  @Delete(':id')
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.archive(actor, parseInput(idSchema, id), requestId);
  }

  @Permissions('BOOSTERS_RESTORE')
  @Post(':id/restore')
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.restore(actor, parseInput(idSchema, id), requestId);
  }

  @Permissions('BOOSTERS_DELETE_PERMANENTLY')
  @Delete(':id/permanent')
  permanentlyDelete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.boosters.permanentlyDelete(actor, parseInput(idSchema, id), requestId);
  }

  @Get(':id/drop-rates') dropRates(@Param('id') id: string) {
    return this.boosters.getDropRates(parseInput(idSchema, id));
  }

  @Permissions('BOOSTERS_MANAGE_DROP_RATES')
  @Put(':id/drop-rates')
  updateDropRates(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.boosters.updateDropRates(
      actor,
      parseInput(idSchema, id),
      parseInput(updateBoosterDropRatesSchema, body),
      requestId,
    );
  }

  @Permissions('BOOSTERS_UPDATE')
  @Post(':id/validate')
  validate(@Param('id') id: string) {
    return this.boosters.validate(parseInput(idSchema, id));
  }
}
