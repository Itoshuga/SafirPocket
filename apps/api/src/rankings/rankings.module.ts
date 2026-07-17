import { Module } from '@nestjs/common';
import { RankingsService } from './rankings.service.js';

@Module({ providers: [RankingsService], exports: [RankingsService] })
export class RankingsModule {}
