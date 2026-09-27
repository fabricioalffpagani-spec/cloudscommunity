import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
type MulterFile = Express.Multer.File;
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FLAT_UPLOAD_FIELD_LIMITS } from '../shared/upload-limits';
import { AuthService } from '../auth/auth.service';
import { CloudMessagesGateway } from './cloud.gateway';
import { CloudService } from './cloud.service';
import type { CreateCloudInput, CreateCloudMessageInput } from './cloud.types';

const SESSION_COOKIE_NAME = 'cc_session';

function extractSessionToken(req: Request): string | null {
  const rawCookie = req.headers.cookie ?? '';
  const cookiePairs = rawCookie.split(';');

  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split('=');
    if (name?.trim() === SESSION_COOKIE_NAME) {
      return rest.join('=').trim() || null;
    }
  }

  return null;
}

@Controller('clouds')
export class CloudController {
  constructor(
    private readonly cloudService: CloudService,
    private readonly authService: AuthService,
    private readonly cloudMessagesGateway: CloudMessagesGateway,
  ) {}

  @Get()
  async feed(@Req() req: Request) {
    const result = await this.cloudService.listFeed(extractSessionToken(req));
    return { ...result, clouds: await this.withLiveCounts(result.clouds) };
  }

  @Get('mine')
  async mine(@Req() req: Request) {
    const result = await this.cloudService.listMine(extractSessionToken(req));
    return { ...result, clouds: await this.withLiveCounts(result.clouds) };
  }

  @Get('read')
  async read(@Req() req: Request, @Query('scope') scope?: string) {
    return this.cloudService.listRead(
      extractSessionToken(req),
      scope === 'following' ? 'following' : 'for-you',
    );
  }

  @Get('stickers')
  async getSavedStickers(@Req() req: Request) {
    return this.cloudService.getSavedStickers(extractSessionToken(req));
  }

  @Get(':id/preview')
  async preview(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.getPreview(extractSessionToken(req), id);
  }

  @Get(':id/archive/messages')
  async archivedMessages(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('take') take?: string,
    @Query('before') before?: string,
  ) {
    return this.cloudService.getArchivedMessages(extractSessionToken(req), id, {
      take: take ? Number(take) : undefined,
      before: before || undefined,
    });
  }

  @Get('following')
  async following(@Req() req: Request) {
    const result = await this.cloudService.listFollowing(
      extractSessionToken(req),
    );
    return { ...result, clouds: await this.withLiveCounts(result.clouds) };
  }

  @Get('invite/:token')
  async resolveInvite(
    @Param('token') inviteToken: string,
    @Req() req: Request,
  ) {
    return this.cloudService.resolveInvite(
      extractSessionToken(req),
      inviteToken,
    );
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: Request) {
    const result = await this.cloudService.findById(
      extractSessionToken(req),
      id,
    );
    return { ...result, cloud: await this.withLiveCount(result.cloud) };
  }

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    const invitedUserIds = Array.isArray(body.invitedUserIds)
      ? body.invitedUserIds.filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0,
        )
      : [];
    const result = await this.cloudService.create(
      extractSessionToken(req),
      {
        title: typeof body.title === 'string' ? body.title : undefined,
        description:
          typeof body.description === 'string' ? body.description : undefined,
        duration: typeof body.duration === 'string' ? body.duration : undefined,
        visibility: body.visibility === 'private' ? 'private' : 'public',
        originCloudId:
          typeof body.originCloudId === 'string'
            ? body.originCloudId
            : undefined,
      } satisfies CreateCloudInput,
      invitedUserIds,
    );
    // Creation is independent from Socket.IO presence. The creator is not in
    // the room yet, so the service response correctly starts at zero.
    return result;
  }

  @Post(':id/invite')
  async createInvite(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.createInvite(extractSessionToken(req), id);
  }

  @Post(':id/join')
  async joinCloud(@Param('id') id: string, @Req() req: Request) {
    const token = extractSessionToken(req);
    const result = await this.cloudService.joinCloud(token, id);
    // A message is emitted only when membership actually changes from outside
    // to inside. Refreshes and tab restores can repeat requests, but cannot
    // be represented as another entry.
    if (result.entered) {
      const systemMessage = await this.cloudService.createJoinNotification(
        id,
        result.userId,
      );
      await this.cloudMessagesGateway.broadcastMessageCreated(
        null,
        id,
        systemMessage,
      );
    }
    const membersCount =
      await this.cloudMessagesGateway.broadcastMembersUpdated(id);
    return { ok: true, membersCount };
  }

  @Post(':id/leave')
  async leaveCloud(@Param('id') id: string, @Req() req: Request) {
    const result = await this.cloudService.leaveCloud(
      extractSessionToken(req),
      id,
    );
    if (result.left) {
      const systemMessage = await this.cloudService.createLeaveNotification(
        id,
        result.userId,
      );
      await this.cloudMessagesGateway.broadcastMessageCreated(
        null,
        id,
        systemMessage,
      );
      const membersCount =
        await this.cloudMessagesGateway.broadcastMembersUpdated(id);
      return { ok: true, membersCount };
    }
    return { ok: true };
  }

  @Post(':id/exit')
  async exitCloudConversation(@Param('id') id: string, @Req() req: Request) {
    const result = await this.cloudService.exitCloudConversation(
      extractSessionToken(req),
      id,
    );
    if (result.left) {
      const systemMessage = await this.cloudService.createLeaveNotification(
        id,
        result.userId,
      );
      await this.cloudMessagesGateway.broadcastMessageCreated(
        null,
        id,
        systemMessage,
      );
      const membersCount =
        await this.cloudMessagesGateway.broadcastMembersUpdated(id);
      return { ok: true, membersCount };
    }
    return { ok: true };
  }

  @Post(':id/hype')
  async hype(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.hype(extractSessionToken(req), id);
  }

  @Delete(':id/hype')
  async unhype(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.unhype(extractSessionToken(req), id);
  }

  @Get(':id/hypes')
  async getHypes(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.getHypes(extractSessionToken(req), id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.delete(extractSessionToken(req), id);
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const result = await this.cloudService.removeMember(
      extractSessionToken(req),
      id,
      userId,
    );
    const membersCount =
      await this.cloudMessagesGateway.broadcastMembersUpdated(id);
    await this.cloudMessagesGateway.broadcastMemberRemoved(id, userId);
    return { ...result, membersCount };
  }

  @Post(':id/members/:userId/ban')
  async banMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const token = extractSessionToken(req);
    const result = await this.cloudService.banMember(token, id, userId);
    // Send system message first so all clients (including the one being banned) see it
    await this.cloudMessagesGateway.broadcastMessageCreated(
      null,
      id,
      result.systemMessage,
    );
    // Then delete reported messages for all clients
    await this.cloudMessagesGateway.broadcastMemberBanned(
      id,
      userId,
      result.deletedMessageIds,
    );
    await this.cloudMessagesGateway.broadcastMembersUpdated(id);
    return { ok: true };
  }

  @Post(':id/reports')
  async reportUser(
    @Param('id') id: string,
    @Body()
    body: {
      reportedId: string;
      messageId?: string;
      messageContent?: string;
      reasons: string[];
    },
    @Req() req: Request,
  ) {
    const result = await this.cloudService.reportUser(
      extractSessionToken(req),
      id,
      body.reportedId,
      body.messageId ?? null,
      body.messageContent ?? null,
      body.reasons ?? [],
    );
    // Push real-time notification to cloud author
    await this.cloudMessagesGateway.broadcastReport(
      result.authorId,
      result.reportPayload,
    );
    return { ok: true };
  }

  @Get(':id/reports')
  async getReports(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.getReports(extractSessionToken(req), id);
  }

  @Patch(':id/messages/:messageId/pin')
  async pinMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    return this.cloudService.pinMessage(
      extractSessionToken(req),
      id,
      messageId,
    );
  }

  @Patch(':id/messages/:messageId/unpin')
  async unpinMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    return this.cloudService.unpinMessage(
      extractSessionToken(req),
      id,
      messageId,
    );
  }

  @Post(':id/pin-message')
  async pinMessagePost(
    @Param('id') id: string,
    @Body() body: { messageId: string },
    @Req() req: Request,
  ) {
    return this.cloudService.pinMessage(
      extractSessionToken(req),
      id,
      body.messageId,
    );
  }

  @Post(':id/unpin-message')
  async unpinMessagePost(
    @Param('id') id: string,
    @Body() body: { messageId: string },
    @Req() req: Request,
  ) {
    return this.cloudService.unpinMessage(
      extractSessionToken(req),
      id,
      body.messageId,
    );
  }

  @Patch(':id/messages/:messageId')
  async editMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() body: { content: string },
    @Req() req: Request,
  ) {
    return this.cloudService.editMessage(
      extractSessionToken(req),
      id,
      messageId,
      body.content,
    );
  }

  @Delete(':id/messages/:messageId')
  async deleteMessage(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    return this.cloudService.deleteMessage(
      extractSessionToken(req),
      id,
      messageId,
    );
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id') id: string,
    @Body() body: CreateCloudMessageInput,
    @Req() req: Request,
  ) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.createMessage(token, id, body);
    await this.cloudMessagesGateway.broadcastMessageCreated(
      session?.user.id ?? null,
      id,
      result.message,
    );
    return result;
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('take') take?: string,
    @Query('before') before?: string,
  ) {
    return this.cloudService.getMessages(extractSessionToken(req), id, {
      take: take ? Number(take) : undefined,
      before: before || undefined,
    });
  }

  @Post(':id/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
        ...FLAT_UPLOAD_FIELD_LIMITS,
      },
    }),
  )
  async sendAudioMessage(
    @Param('id') id: string,
    @Req() req: Request,
    @UploadedFile() file?: MulterFile,
    @Body() body: Record<string, unknown> = {},
  ) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.sendAudioMessage(
      token,
      id,
      {
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
      },
      file,
    );
    await this.cloudMessagesGateway.broadcastMessageCreated(
      session?.user.id ?? null,
      id,
      result.message,
    );
    return result;
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
        ...FLAT_UPLOAD_FIELD_LIMITS,
      },
    }),
  )
  async sendImageMessage(
    @Param('id') id: string,
    @Req() req: Request,
    @UploadedFile() file?: MulterFile,
    @Body() body: Record<string, unknown> = {},
  ) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.sendImageMessage(
      token,
      id,
      {
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
        isSticker: body.isSticker === 'true',
      },
      file,
    );
    await this.cloudMessagesGateway.broadcastMessageCreated(
      session?.user.id ?? null,
      id,
      result.message,
    );
    return result;
  }

  @Post('stickers')
  async saveSticker(@Req() req: Request, @Body() body: { mediaUrl?: string }) {
    return this.cloudService.saveSticker(
      extractSessionToken(req),
      body.mediaUrl,
    );
  }

  @Post(':id/messages/:messageId/reactions')
  async addReaction(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Body() body: { emoji: string },
    @Req() req: Request,
  ) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.addReaction(
      token,
      id,
      messageId,
      body.emoji,
    );
    await this.cloudMessagesGateway.broadcastReactionChange(
      session?.user.id ?? null,
      id,
      messageId,
      result.reaction,
      result.removed,
    );
    return result;
  }

  @Get(':id/messages/:messageId/reactions')
  async getMessageReactions(
    @Param('id') id: string,
    @Param('messageId') messageId: string,
    @Req() req: Request,
  ) {
    return this.cloudService.getMessageReactions(
      extractSessionToken(req),
      id,
      messageId,
    );
  }

  private async withLiveCount<T extends { id: string; membersCount: number }>(
    cloud: T,
  ): Promise<T> {
    return {
      ...cloud,
      membersCount: await this.cloudMessagesGateway.getConnectedMemberCount(
        cloud.id,
      ),
    };
  }

  private async withLiveCounts<T extends { id: string; membersCount: number }>(
    clouds: T[],
  ): Promise<T[]> {
    return Promise.all(clouds.map((cloud) => this.withLiveCount(cloud)));
  }
}
