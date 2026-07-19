import { Injectable } from '@nestjs/common';
import type { UserPreferencesUpdateInput } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserPreferences } from './preferences.mapper.js';

@Injectable()
export class PreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const preferences = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return toUserPreferences(preferences);
  }

  async update(userId: string, input: UserPreferencesUpdateInput) {
    const preferences = await this.prisma.userPreference.upsert({
      where: { userId },
      create: { userId, ...input },
      update: input,
    });
    return toUserPreferences(preferences);
  }
}
