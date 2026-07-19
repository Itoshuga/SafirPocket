import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';
import { PreferencesController } from './preferences.controller.js';
import { PreferencesService } from './preferences.service.js';
import { AvatarStorageService } from './avatar-storage.service.js';

@Module({
  controllers: [ProfilesController, PreferencesController],
  providers: [ProfilesService, PreferencesService, AvatarStorageService],
})
export class ProfilesModule {}
