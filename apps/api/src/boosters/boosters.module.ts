import { Module } from '@nestjs/common';
import { BoostersController } from './boosters.controller.js';
import { BoostersService } from './boosters.service.js';
import { BoosterDrawService, BoosterRandomService } from './booster-draw.service.js';

@Module({
  controllers: [BoostersController],
  providers: [BoostersService, BoosterDrawService, BoosterRandomService],
})
export class BoostersModule {}
