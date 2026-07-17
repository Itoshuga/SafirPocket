import { Module } from '@nestjs/common';
import { MissionsService } from './missions.service.js';

@Module({ providers: [MissionsService], exports: [MissionsService] })
export class MissionsModule {}
