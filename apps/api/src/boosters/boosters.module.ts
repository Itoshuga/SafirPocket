import { Module } from '@nestjs/common';
import { BoostersController } from './boosters.controller.js';
import { BoostersService } from './boosters.service.js';

@Module({ controllers: [BoostersController], providers: [BoostersService] })
export class BoostersModule {}
