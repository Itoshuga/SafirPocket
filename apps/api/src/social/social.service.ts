import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ROLE_LABELS,
  type BlockedUser,
  type FriendRequest,
  type Friendship,
} from '@safir/shared-types';
import { normalizeUsername } from '@safir/validation';
import type {
  FriendRequest as DatabaseFriendRequest,
  UserProfile,
} from '../generated/prisma/client.js';
import { PrismaService, type PrismaTransactionClient } from '../prisma/prisma.service.js';

const friendUserSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

type FriendUserRow = Pick<UserProfile, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'role'>;
type FriendRequestRow = DatabaseFriendRequest & {
  sender: FriendUserRow;
  receiver: FriendUserRow;
};

@Injectable()
export class SocialService {
  constructor(private readonly prisma: PrismaService) {}

  async friends(userId: string): Promise<Friendship[]> {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userOneId: userId }, { userTwoId: userId }] },
      include: {
        userOne: { select: friendUserSelect },
        userTwo: { select: friendUserSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
    return friendships.map((friendship) => ({
      id: friendship.id,
      user: this.toFriendUser(
        friendship.userOneId === userId ? friendship.userTwo : friendship.userOne,
      ),
      createdAt: friendship.createdAt.toISOString(),
    }));
  }

  async received(userId: string): Promise<FriendRequest[]> {
    return this.requests({ receiverUserId: userId, status: 'PENDING' });
  }

  async sent(userId: string): Promise<FriendRequest[]> {
    return this.requests({ senderUserId: userId, status: 'PENDING' });
  }

  async requestByUsername(userId: string, username: string): Promise<FriendRequest> {
    return this.request(userId, await this.targetIdByUsername(username));
  }

  async acceptByUsername(userId: string, username: string): Promise<Friendship> {
    const targetUserId = await this.targetIdByUsername(username);
    const request = await this.prisma.friendRequest.findFirst({
      where: { senderUserId: targetUserId, receiverUserId: userId, status: 'PENDING' },
      select: { id: true },
    });
    if (!request) this.requestNotFound();
    return this.accept(userId, request.id);
  }

  async declineByUsername(userId: string, username: string): Promise<FriendRequest> {
    const targetUserId = await this.targetIdByUsername(username);
    const request = await this.prisma.friendRequest.findFirst({
      where: { senderUserId: targetUserId, receiverUserId: userId, status: 'PENDING' },
      select: { id: true },
    });
    if (!request) this.requestNotFound();
    return this.decline(userId, request.id);
  }

  async removeFriendByUsername(userId: string, username: string): Promise<{ removed: true }> {
    return this.removeFriend(userId, await this.targetIdByUsername(username));
  }

  async blockByUsername(userId: string, username: string): Promise<BlockedUser> {
    return this.block(userId, await this.targetIdByUsername(username));
  }

  async unblockByUsername(userId: string, username: string): Promise<{ removed: true }> {
    return this.unblock(userId, await this.targetIdByUsername(username));
  }

  async request(userId: string, targetUserId: string): Promise<FriendRequest> {
    if (userId === targetUserId) {
      throw new BadRequestException({
        code: 'FRIEND_REQUEST_SELF',
        message: "Vous ne pouvez pas vous envoyer une demande d'ami.",
      });
    }
    try {
      const request = await this.prisma.runInTransaction(
        async (transaction) => {
          const target = await transaction.userProfile.findUnique({
            where: { id: targetUserId },
            include: { preferences: true },
          });
          if (
            !target ||
            target.status !== 'ACTIVE' ||
            target.isDeactivated ||
            !target.preferences?.allowFriendRequests
          ) {
            throw new ConflictException({
              code: 'FRIEND_REQUEST_NOT_AVAILABLE',
              message: "La demande d'ami ne peut pas être envoyée.",
            });
          }
          await this.assertNoBlock(transaction, userId, targetUserId);
          const [userOneId, userTwoId] = this.canonicalPair(userId, targetUserId);
          const friendship = await transaction.friendship.findUnique({
            where: { userOneId_userTwoId: { userOneId, userTwoId } },
          });
          if (friendship) this.alreadyFriends();
          const pending = await transaction.friendRequest.findFirst({
            where: {
              status: 'PENDING',
              OR: [
                { senderUserId: userId, receiverUserId: targetUserId },
                { senderUserId: targetUserId, receiverUserId: userId },
              ],
            },
          });
          if (pending) {
            throw new ConflictException({
              code: 'FRIEND_REQUEST_ALREADY_PENDING',
              message: "Une demande d'ami est déjà en attente entre ces comptes.",
            });
          }
          const created = await transaction.friendRequest.create({
            data: { senderUserId: userId, receiverUserId: targetUserId },
            include: {
              sender: { select: friendUserSelect },
              receiver: { select: friendUserSelect },
            },
          });
          await transaction.userSecurityEvent.create({
            data: {
              userId,
              eventType: 'FRIEND_REQUEST_SENT',
              metadata: { receiverUserId: targetUserId, requestId: created.id },
            },
          });
          return created;
        },
        { isolationLevel: 'Serializable' },
      );
      return this.toFriendRequest(request);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'FRIEND_REQUEST_ALREADY_PENDING',
          message: "Une demande d'ami est déjà en attente entre ces comptes.",
        });
      }
      throw error;
    }
  }

  async accept(userId: string, requestId: string): Promise<Friendship> {
    return this.prisma.runInTransaction(
      async (transaction) => {
        const request = await transaction.friendRequest.findUnique({
          where: { id: requestId },
          include: { sender: true, receiver: true },
        });
        if (!request || request.receiverUserId !== userId) this.requestNotFound();
        if (request.status !== 'PENDING') this.requestAlreadyHandled();
        if (
          request.sender.status !== 'ACTIVE' ||
          request.sender.isDeactivated ||
          request.receiver.status !== 'ACTIVE' ||
          request.receiver.isDeactivated
        ) {
          throw new ConflictException({
            code: 'FRIEND_ACCOUNT_UNAVAILABLE',
            message: "Cette demande d'ami ne peut plus être acceptée.",
          });
        }
        await this.assertNoBlock(transaction, request.senderUserId, request.receiverUserId);
        const [userOneId, userTwoId] = this.canonicalPair(
          request.senderUserId,
          request.receiverUserId,
        );
        const friendship = await transaction.friendship.upsert({
          where: { userOneId_userTwoId: { userOneId, userTwoId } },
          create: { userOneId, userTwoId },
          update: {},
          include: {
            userOne: { select: friendUserSelect },
            userTwo: { select: friendUserSelect },
          },
        });
        await transaction.friendRequest.update({
          where: { id: request.id },
          data: { status: 'ACCEPTED', respondedAt: new Date() },
        });
        await transaction.userSecurityEvent.create({
          data: {
            userId,
            eventType: 'FRIEND_REQUEST_ACCEPTED',
            metadata: { senderUserId: request.senderUserId, requestId },
          },
        });
        return {
          id: friendship.id,
          user: this.toFriendUser(
            friendship.userOneId === userId ? friendship.userTwo : friendship.userOne,
          ),
          createdAt: friendship.createdAt.toISOString(),
        };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async decline(userId: string, requestId: string): Promise<FriendRequest> {
    return this.respond(userId, requestId, 'DECLINED');
  }

  async cancel(userId: string, requestId: string): Promise<FriendRequest> {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
    if (!request || request.senderUserId !== userId) this.requestNotFound();
    if (request.status !== 'PENDING') this.requestAlreadyHandled();
    const cancelled = await this.prisma.friendRequest.update({
      where: { id: request.id },
      data: { status: 'CANCELLED', respondedAt: new Date() },
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
    return this.toFriendRequest(cancelled);
  }

  async removeFriend(userId: string, friendId: string): Promise<{ removed: true }> {
    const [userOneId, userTwoId] = this.canonicalPair(userId, friendId);
    const result = await this.prisma.friendship.deleteMany({ where: { userOneId, userTwoId } });
    if (!result.count) {
      throw new NotFoundException({
        code: 'FRIENDSHIP_NOT_FOUND',
        message: 'Cette amitié est introuvable.',
      });
    }
    return { removed: true };
  }

  async blocked(userId: string): Promise<BlockedUser[]> {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerUserId: userId },
      include: { blocked: { select: friendUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
    return blocks.map((block) => ({
      user: this.toFriendUser(block.blocked),
      blockedAt: block.createdAt.toISOString(),
    }));
  }

  async block(userId: string, targetUserId: string): Promise<BlockedUser> {
    if (userId === targetUserId) {
      throw new BadRequestException({
        code: 'USER_BLOCK_SELF',
        message: 'Vous ne pouvez pas vous bloquer vous-même.',
      });
    }
    return this.prisma.runInTransaction(
      async (transaction) => {
        const target = await transaction.userProfile.findUnique({
          where: { id: targetUserId },
          select: friendUserSelect,
        });
        if (!target) {
          throw new NotFoundException({
            code: 'USER_NOT_FOUND',
            message: 'Utilisateur introuvable.',
          });
        }
        const block = await transaction.userBlock.upsert({
          where: {
            blockerUserId_blockedUserId: {
              blockerUserId: userId,
              blockedUserId: targetUserId,
            },
          },
          create: { blockerUserId: userId, blockedUserId: targetUserId },
          update: {},
        });
        await transaction.friendRequest.updateMany({
          where: {
            status: 'PENDING',
            OR: [
              { senderUserId: userId, receiverUserId: targetUserId },
              { senderUserId: targetUserId, receiverUserId: userId },
            ],
          },
          data: { status: 'CANCELLED', respondedAt: new Date() },
        });
        const [userOneId, userTwoId] = this.canonicalPair(userId, targetUserId);
        await transaction.friendship.deleteMany({ where: { userOneId, userTwoId } });
        await transaction.userSecurityEvent.create({
          data: {
            userId,
            eventType: 'USER_BLOCKED',
            metadata: { blockedUserId: targetUserId },
          },
        });
        return { user: this.toFriendUser(target), blockedAt: block.createdAt.toISOString() };
      },
      { isolationLevel: 'Serializable' },
    );
  }

  async unblock(userId: string, targetUserId: string): Promise<{ removed: true }> {
    const result = await this.prisma.userBlock.deleteMany({
      where: { blockerUserId: userId, blockedUserId: targetUserId },
    });
    if (!result.count) {
      throw new NotFoundException({
        code: 'USER_BLOCK_NOT_FOUND',
        message: 'Ce blocage est introuvable.',
      });
    }
    return { removed: true };
  }

  private async respond(userId: string, requestId: string, status: 'DECLINED') {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
    if (!request || request.receiverUserId !== userId) this.requestNotFound();
    if (request.status !== 'PENDING') this.requestAlreadyHandled();
    const updated = await this.prisma.friendRequest.update({
      where: { id: request.id },
      data: { status, respondedAt: new Date() },
      include: {
        sender: { select: friendUserSelect },
        receiver: { select: friendUserSelect },
      },
    });
    return this.toFriendRequest(updated);
  }

  private requests(where: {
    senderUserId?: string;
    receiverUserId?: string;
    status: 'PENDING';
  }): Promise<FriendRequest[]> {
    return this.prisma.friendRequest
      .findMany({
        where,
        include: {
          sender: { select: friendUserSelect },
          receiver: { select: friendUserSelect },
        },
        orderBy: { createdAt: 'desc' },
      })
      .then((requests) => requests.map((request) => this.toFriendRequest(request)));
  }

  private async assertNoBlock(
    transaction: PrismaTransactionClient,
    firstUserId: string,
    secondUserId: string,
  ): Promise<void> {
    const block = await transaction.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: firstUserId, blockedUserId: secondUserId },
          { blockerUserId: secondUserId, blockedUserId: firstUserId },
        ],
      },
    });
    if (block) {
      throw new ConflictException({
        code: 'FRIEND_REQUEST_NOT_AVAILABLE',
        message: "La demande d'ami ne peut pas être traitée.",
      });
    }
  }

  private canonicalPair(firstUserId: string, secondUserId: string): [string, string] {
    return firstUserId < secondUserId ? [firstUserId, secondUserId] : [secondUserId, firstUserId];
  }

  private async targetIdByUsername(username: string): Promise<string> {
    const target = await this.prisma.userProfile.findUnique({
      where: { normalizedUsername: normalizeUsername(username) },
      select: { id: true, status: true, isDeactivated: true, deletionProcessedAt: true },
    });
    if (
      !target ||
      target.status !== 'ACTIVE' ||
      target.isDeactivated ||
      target.deletionProcessedAt
    ) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Utilisateur introuvable.',
      });
    }
    return target.id;
  }

  private toFriendUser(user: FriendUserRow) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      isPioneer: user.role === 'PIONEER',
    };
  }

  private toFriendRequest(request: FriendRequestRow): FriendRequest {
    return {
      id: request.id,
      status: request.status,
      sender: this.toFriendUser(request.sender),
      receiver: this.toFriendUser(request.receiver),
      createdAt: request.createdAt.toISOString(),
      updatedAt: request.updatedAt.toISOString(),
      respondedAt: request.respondedAt?.toISOString() ?? null,
    };
  }

  private alreadyFriends(): never {
    throw new ConflictException({
      code: 'ALREADY_FRIENDS',
      message: 'Ces comptes sont déjà amis.',
    });
  }

  private requestNotFound(): never {
    throw new NotFoundException({
      code: 'FRIEND_REQUEST_NOT_FOUND',
      message: "Cette demande d'ami est introuvable.",
    });
  }

  private requestAlreadyHandled(): never {
    throw new ConflictException({
      code: 'FRIEND_REQUEST_ALREADY_HANDLED',
      message: "Cette demande d'ami a déjà été traitée.",
    });
  }
}
