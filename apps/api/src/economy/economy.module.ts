import { Module } from '@nestjs/common';
import { EconomyService } from './economy.service.js';
import { EconomyController } from './economy.controller.js';

@Module({
  controllers: [EconomyController],
  providers: [EconomyService],
  exports: [EconomyService],
})
export class EconomyModule {}
