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
import type { File as MulterFile } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from '../auth/auth.service';
import { CloudMessagesGateway } from './cloud.gateway';
import { CloudService } from './cloud.service';
import { CreateCloudInput } from './cloud.types';

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
    return this.cloudService.listFeed(extractSessionToken(req));
  }

  @Get('mine')
  async mine(@Req() req: Request) {
    return this.cloudService.listMine(extractSessionToken(req));
  }

  @Get('following')
  async following(@Req() req: Request) {
    return this.cloudService.listFollowing(extractSessionToken(req));
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.findById(extractSessionToken(req), id);
  }

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.cloudService.create(extractSessionToken(req), {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      duration: typeof body.duration === 'string' ? body.duration : undefined,
      visibility: body.visibility === 'private' ? 'private' : 'public',
    } satisfies CreateCloudInput);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.delete(extractSessionToken(req), id);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string, @Req() req: Request) {
    return this.cloudService.removeMember(extractSessionToken(req), id, userId);
  }

  @Patch(':id/messages/:messageId/pin')
  async pinMessage(@Param('id') id: string, @Param('messageId') messageId: string, @Req() req: Request) {
    return this.cloudService.pinMessage(extractSessionToken(req), id, messageId);
  }

  @Patch(':id/messages/:messageId/unpin')
  async unpinMessage(@Param('id') id: string, @Param('messageId') messageId: string, @Req() req: Request) {
    return this.cloudService.unpinMessage(extractSessionToken(req), id, messageId);
  }

  @Post(':id/pin-message')
  async pinMessagePost(@Param('id') id: string, @Body() body: { messageId: string }, @Req() req: Request) {
    return this.cloudService.pinMessage(extractSessionToken(req), id, body.messageId);
  }

  @Post(':id/unpin-message')
  async unpinMessagePost(@Param('id') id: string, @Body() body: { messageId: string }, @Req() req: Request) {
    return this.cloudService.unpinMessage(extractSessionToken(req), id, body.messageId);
  }

  @Post(':id/messages')
  async createMessage(@Param('id') id: string, @Body() body: { type: string; content?: string; mediaUrl?: string; replyToMessageId?: string }, @Req() req: Request) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.createMessage(token, id, body);
    await this.cloudMessagesGateway.broadcastMessageCreated(session?.user.id ?? null, id, result.message);
    return result;
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req: Request, @Query('take') take?: string, @Query('before') before?: string) {
    return this.cloudService.getMessages(extractSessionToken(req), id, {
      take: take ? Number(take) : undefined,
      before: before || undefined,
    });
  }

  @Post(':id/audio')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: 25 * 1024 * 1024,
    },
  }))
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
        clientMessageId: typeof body.clientMessageId === 'string' ? body.clientMessageId : undefined,
        replyToMessageId: typeof body.replyToMessageId === 'string' ? body.replyToMessageId : undefined,
      },
      file as MulterFile,
    );
    await this.cloudMessagesGateway.broadcastMessageCreated(session?.user.id ?? null, id, result.message);
    return result;
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  }))
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
        clientMessageId: typeof body.clientMessageId === 'string' ? body.clientMessageId : undefined,
        replyToMessageId: typeof body.replyToMessageId === 'string' ? body.replyToMessageId : undefined,
      },
      file as MulterFile,
    );
    await this.cloudMessagesGateway.broadcastMessageCreated(session?.user.id ?? null, id, result.message);
    return result;
  }

  @Post(':id/messages/:messageId/reactions')
  async addReaction(@Param('id') id: string, @Param('messageId') messageId: string, @Body() body: { emoji: string }, @Req() req: Request) {
    const token = extractSessionToken(req);
    const session = await this.authService.resolveSession(token);
    const result = await this.cloudService.addReaction(token, id, messageId, body.emoji);
    await this.cloudMessagesGateway.broadcastReactionChange(session?.user.id ?? null, id, messageId, result.reaction, result.removed);
    return result;
  }

  @Get(':id/messages/:messageId/reactions')
  async getMessageReactions(@Param('id') id: string, @Param('messageId') messageId: string, @Req() req: Request) {
    return this.cloudService.getMessageReactions(extractSessionToken(req), id, messageId);
  }
}
