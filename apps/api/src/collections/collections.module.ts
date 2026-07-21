import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller.js';
import { CollectionsService } from './collections.service.js';
import { PublicCollectionsController } from './public-collections.controller.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [UsersModule],
  controllers: [CollectionsController, PublicCollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
