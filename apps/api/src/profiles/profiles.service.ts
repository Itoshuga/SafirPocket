import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ProfileUpdateInput } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string) {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile)
      throw new NotFoundException({ code: 'PROFILE_NOT_FOUND', message: 'Profil introuvable.' });
    return profile;
  }

  async updateMe(userId: string, input: ProfileUpdateInput) {
    if (input.username) {
      const existing = await this.prisma.profile.findFirst({
        where: { username: { equals: input.username, mode: 'insensitive' }, NOT: { id: userId } },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException({
          code: 'USERNAME_UNAVAILABLE',
          message: "Ce nom d'utilisateur est déjà utilisé.",
        });
      }
    }
    return this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(input.username !== undefined ? { username: input.username } : {}),
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.avatarPath !== undefined ? { avatarPath: input.avatarPath } : {}),
      },
    });
  }
}
