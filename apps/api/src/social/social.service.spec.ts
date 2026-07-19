import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SocialService } from './social.service.js';

const userId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const now = new Date();

function setup(options: { pending?: boolean; blocked?: boolean } = {}) {
  const target = {
    id: targetId,
    username: 'target',
    displayName: 'Target',
    avatarUrl: null,
    role: 'USER' as const,
    status: 'ACTIVE' as const,
    isDeactivated: false,
    preferences: { allowFriendRequests: true },
  };
  const request = {
    id: crypto.randomUUID(),
    senderUserId: userId,
    receiverUserId: targetId,
    status: 'PENDING' as const,
    createdAt: now,
    updatedAt: now,
    respondedAt: null,
    sender: { ...target, id: userId, username: 'sender', displayName: 'Sender' },
    receiver: target,
  };
  const transaction = {
    userProfile: { findUnique: vi.fn().mockResolvedValue(target) },
    userBlock: {
      findFirst: vi.fn().mockResolvedValue(options.blocked ? { blockerUserId: targetId } : null),
      upsert: vi.fn().mockResolvedValue({ createdAt: now }),
    },
    friendship: {
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    friendRequest: {
      findFirst: vi.fn().mockResolvedValue(options.pending ? request : null),
      create: vi.fn().mockResolvedValue(request),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    userSecurityEvent: { create: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    runInTransaction: vi.fn((operation) => operation(transaction)),
  };
  return { service: new SocialService(prisma as never), transaction };
}

describe('SocialService', () => {
  it('refuses a request to oneself', async () => {
    const { service } = setup();
    await expect(service.request(userId, userId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses duplicate and inverse pending requests', async () => {
    const { service } = setup({ pending: true });
    await expect(service.request(userId, targetId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses a request whenever either direction is blocked', async () => {
    const { service } = setup({ blocked: true });
    await expect(service.request(userId, targetId)).rejects.toBeInstanceOf(ConflictException);
  });

  it('cancels pending requests and removes friendship while blocking', async () => {
    const { service, transaction } = setup();
    await service.block(userId, targetId);
    expect(transaction.friendRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) }),
    );
    expect(transaction.friendship.deleteMany).toHaveBeenCalled();
    expect(transaction.userSecurityEvent.create).toHaveBeenCalled();
  });
});
