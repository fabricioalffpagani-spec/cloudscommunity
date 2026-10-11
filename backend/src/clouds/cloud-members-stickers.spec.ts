import { CloudService } from './cloud.service';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PushNotificationsService } from '../infrastructure/push/push-notifications.service';
import { CloudTopicClassifierService } from './topic-classification/cloud-topic-classifier.service';

describe('personal stickers and active membership', () => {
  let userId = 'user-a';
  const rows: Array<{
    id: string;
    userId: string;
    mediaUrl: string;
    contentHash: string;
    createdAt: Date;
    lastUsedAt: Date | null;
  }> = [];
  const prisma = {
    savedSticker: {
      findMany: jest.fn(({ where }: { where: { userId: string } }) =>
        rows
          .filter((row) => row.userId === where.userId)
          .sort(
            (a, b) =>
              (b.lastUsedAt?.getTime() ?? 0) - (a.lastUsedAt?.getTime() ?? 0) ||
              b.createdAt.getTime() - a.createdAt.getTime(),
          ),
      ),
      findUnique: jest.fn(
        ({
          where,
        }: {
          where: {
            userId_contentHash: { userId: string; contentHash: string };
          };
        }) =>
          rows.find(
            (row) =>
              row.userId === where.userId_contentHash.userId &&
              row.contentHash === where.userId_contentHash.contentHash,
          ) ?? null,
      ),
      create: jest.fn(
        ({
          data,
        }: {
          data: { userId: string; mediaUrl: string; contentHash: string };
        }) => {
          const row = {
            ...data,
            id: String(rows.length),
            createdAt: new Date(),
            lastUsedAt: null,
          };
          rows.push(row);
          return row;
        },
      ),
      upsert: jest.fn(
        ({
          where,
          update,
        }: {
          where: {
            userId_contentHash: { userId: string; contentHash: string };
          };
          update: { lastUsedAt: Date };
        }) => {
          const row = rows.find(
            (item) =>
              item.userId === where.userId_contentHash.userId &&
              item.contentHash === where.userId_contentHash.contentHash,
          )!;
          row.lastUsedAt = update.lastUsedAt;
          return row;
        },
      ),
      deleteMany: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) => {
          const index = rows.findIndex(
            (row) => row.id === where.id && row.userId === where.userId,
          );
          if (index >= 0) rows.splice(index, 1);
        },
      ),
    },
    cloudMember: { findMany: jest.fn().mockResolvedValue([]) },
    cloud: { findMany: jest.fn().mockResolvedValue([]) },
    userBlock: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new CloudService(
    prisma as unknown as PrismaService,
    {
      resolveSession: jest.fn(() => ({ user: { id: userId } })),
    } as unknown as AuthService,
    { send: jest.fn() } as unknown as PushNotificationsService,
    { classify: jest.fn() } as unknown as CloudTopicClassifierService,
  );

  beforeEach(() => {
    rows.length = 0;
    userId = 'user-a';
    jest.clearAllMocks();
  });

  it('isolates A and B saves and their recent use', async () => {
    const image = 'data:image/png;base64,aGVsbG8=';
    await service.saveSticker(null, image);
    const aStickerId = (await service.getSavedStickers(null)).stickers[0].id;
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(1);
    userId = 'user-b';
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(0);
    await service.saveSticker(null, image);
    await service.markStickerUsed(null, image);
    expect(
      (await service.getSavedStickers(null)).stickers[0].lastUsedAt,
    ).not.toBeNull();
    const bStickerId = (await service.getSavedStickers(null)).stickers[0].id;
    userId = 'user-a';
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(1);
    expect(
      (await service.getSavedStickers(null)).stickers[0].lastUsedAt,
    ).toBeNull();
    expect(rows.map((row) => row.userId)).toEqual(['user-a', 'user-b']);
    await service.removeSavedSticker(null, bStickerId);
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(1);
    userId = 'user-b';
    await service.removeSavedSticker(null, bStickerId);
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(0);
    userId = 'user-a';
    expect((await service.getSavedStickers(null)).stickers).toHaveLength(1);
    expect((await service.getSavedStickers(null)).stickers[0].id).toBe(
      aStickerId,
    );
  });

  it('queries only active members after a leave', async () => {
    await service.getActiveMembers('cloud-id');
    expect(prisma.cloudMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cloudId: 'cloud-id', leftAt: null },
      }),
    );
  });
});
