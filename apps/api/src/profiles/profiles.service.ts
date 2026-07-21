import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdateInput, UpdateProfileBannerInput } from '@safir/validation';
import { normalizeUsername } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserProfile } from './profile.mapper.js';
import { AvatarStorageService } from './avatar-storage.service.js';
import { ProfileStatsService } from './profile-stats.service.js';
import { BannerStorageService } from './banner-storage.service.js';

const usernameCooldownMs = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorageService,
    private readonly banners: BannerStorageService,
    private readonly profileStats: ProfileStatsService,
  ) {}

  async getMe(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!profile)
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    return toUserProfile(profile);
  }

  async updateMe(userId: string, input: ProfileUpdateInput) {
    const current = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    }
    const nextUsername = input.username;
    const usernameChanges = nextUsername !== undefined && nextUsername !== current.username;
    if (nextUsername !== undefined && nextUsername !== current.username) {
      const availableAt = current.usernameChangedAt
        ? new Date(current.usernameChangedAt.getTime() + usernameCooldownMs)
        : null;
      if (availableAt && availableAt > new Date()) {
        throw new ConflictException({
          code: 'USERNAME_CHANGE_COOLDOWN',
          message: "Le nom d'utilisateur ne peut être modifié qu'une fois tous les 30 jours.",
          details: { availableAt: availableAt.toISOString() },
          fieldErrors: {
            username: [
              `Un nouveau changement sera possible le ${availableAt.toLocaleDateString('fr-FR')}.`,
            ],
          },
        });
      }
      const existing = await this.prisma.userProfile.findFirst({
        where: { normalizedUsername: normalizeUsername(nextUsername), NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'USERNAME_ALREADY_EXISTS',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
    }
    if (input.avatarUrl) await this.avatars.verifyOwnedAvatar(userId, input.avatarUrl);
    try {
      const profile = await this.prisma.userProfile.update({
        where: { id: userId },
        data: {
          ...(input.username !== undefined
            ? {
                username: input.username,
                normalizedUsername: normalizeUsername(input.username),
                ...(usernameChanges ? { usernameChangedAt: new Date() } : {}),
              }
            : {}),
          ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
        },
      });
      if (input.avatarUrl !== undefined && input.avatarUrl !== current.avatarUrl) {
        await this.avatars.remove(current.avatarUrl);
      }
      return toUserProfile(profile);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'USERNAME_ALREADY_EXISTS',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
      throw error;
    }
  }

  async summary(userId: string) {
    return this.profileStats.legacySummary(userId);
  }

  async updateBanner(userId: string, input: UpdateProfileBannerInput) {
    const current = await this.prisma.userProfile.findUnique({ where: { id: userId } });
    if (!current) {
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    }
    if (input.bannerUrl) await this.banners.verifyOwnedBanner(userId, input.bannerUrl);
    const profile = await this.prisma.userProfile.update({
      where: { id: userId },
      data: {
        ...(input.bannerUrl !== undefined ? { bannerUrl: input.bannerUrl } : {}),
        ...(input.bannerPositionY !== undefined ? { bannerPositionY: input.bannerPositionY } : {}),
      },
    });
    if (input.bannerUrl !== undefined && input.bannerUrl !== current.bannerUrl) {
      await this.banners.remove(current.bannerUrl);
    }
    return toUserProfile(profile);
  }

  removeBanner(userId: string) {
    return this.updateBanner(userId, { bannerUrl: null, bannerPositionY: 50 });
  }
}
