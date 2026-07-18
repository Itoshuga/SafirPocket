import { Injectable } from '@nestjs/common';
import { normalizeUsername } from '@safir/validation';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async usernameAvailability(username: string) {
    const normalizedUsername = normalizeUsername(username);
    const existing = await this.prisma.userProfile.findUnique({
      where: { normalizedUsername },
      select: { id: true },
    });
    return { username, normalizedUsername, available: !existing };
  }
}
