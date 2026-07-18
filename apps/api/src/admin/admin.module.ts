import { Module } from '@nestjs/common';
import { AdminCardsController } from './admin-cards.controller.js';
import { AdminCardsService } from './admin-cards.service.js';
import { AdminCardTypesController } from './admin-card-types.controller.js';
import { AdminController } from './admin.controller.js';
import { AdminRaritiesController } from './admin-rarities.controller.js';
import { AdminSeasonsController } from './admin-seasons.controller.js';
import { AdminTaxonomiesService } from './admin-taxonomies.service.js';
import { AdminUsersController } from './admin-users.controller.js';
import { AdminUsersService } from './admin-users.service.js';
import { SupabaseAdminAuthService } from './supabase-admin-auth.service.js';

@Module({
  controllers: [
    AdminController,
    AdminUsersController,
    AdminCardsController,
    AdminRaritiesController,
    AdminSeasonsController,
    AdminCardTypesController,
  ],
  providers: [
    AdminUsersService,
    AdminCardsService,
    AdminTaxonomiesService,
    SupabaseAdminAuthService,
  ],
})
export class AdminModule {}
