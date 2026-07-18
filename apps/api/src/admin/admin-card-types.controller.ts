import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  adminTaxonomyQuerySchema,
  createCardTypeSchema,
  idSchema,
  updateCardTypeSchema,
} from '@safir/validation';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../common/auth/auth.types.js';
import { Permissions } from '../common/auth/permissions.decorator.js';
import { parseInput } from '../common/errors/zod.js';
import { RequestId } from '../common/logging/request-id.decorator.js';
import { AdminTaxonomiesService } from './admin-taxonomies.service.js';

@Permissions('CARDS_READ_ADMIN')
@Controller('api/v1/admin/card-types')
export class AdminCardTypesController {
  constructor(private readonly taxonomies: AdminTaxonomiesService) {}

  @Get() list(@Query() query: unknown) {
    return this.taxonomies.listTypes(parseInput(adminTaxonomyQuerySchema, query));
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.taxonomies.getType(parseInput(idSchema, id));
  }
  @Permissions('CATALOG_CREATE')
  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.taxonomies.createType(actor, parseInput(createCardTypeSchema, body), requestId);
  }
  @Permissions('CATALOG_UPDATE')
  @Patch(':id')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
    @RequestId() requestId: string,
  ) {
    return this.taxonomies.updateType(
      actor,
      parseInput(idSchema, id),
      parseInput(updateCardTypeSchema, body),
      requestId,
    );
  }
  @Permissions('CATALOG_ARCHIVE')
  @Delete(':id')
  archive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.taxonomies.archiveType(actor, parseInput(idSchema, id), requestId);
  }
  @Permissions('CATALOG_RESTORE')
  @Post(':id/restore')
  restore(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.taxonomies.restoreType(actor, parseInput(idSchema, id), requestId);
  }
  @Permissions('CATALOG_DELETE_PERMANENTLY')
  @Delete(':id/permanent')
  delete(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @RequestId() requestId: string,
  ) {
    return this.taxonomies.deleteType(actor, parseInput(idSchema, id), requestId);
  }
}
