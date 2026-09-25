import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import type { File as MulterFile } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from '../auth/auth.service';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants';
import { DirectMessagesGateway } from './direct-messages.gateway';
import { DirectMessagesService } from './direct-messages.service';

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

@Controller('direct-messages')
export class DirectMessagesController {
  constructor(
    private readonly authService: AuthService,
    private readonly directMessagesService: DirectMessagesService,
    private readonly directMessagesGateway: DirectMessagesGateway,
  ) {}

  @Get('conversations')
  async listConversations(@Req() req: Request) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    return {
      ok: true as const,
      conversations: await this.directMessagesService.listConversations(
        session.user.id,
      ),
    };
  }

  @Get('conversations/:conversationId/messages')
  async listMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query('take') take?: string,
    @Query('before') before?: string,
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    return {
      ok: true as const,
      messages: await this.directMessagesService.listMessages(
        session.user.id,
        conversationId,
        {
          take: take ? Number(take) : undefined,
          before: before || undefined,
        },
      ),
    };
  }

  @Post('conversations')
  async createOrResolveConversation(
    @Req() req: Request,
    @Body() body: Record<string, unknown>,
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    const peerUserId =
      typeof body.peerUserId === 'string' ? body.peerUserId : '';

    return {
      ok: true as const,
      conversation:
        await this.directMessagesService.createOrResolveConversation(
          session.user.id,
          {
            peerUserId,
          },
        ),
    };
  }

  @Post('conversations/:conversationId/messages')
  async sendTextMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    const message = await this.directMessagesService.sendTextMessage(
      session.user.id,
      {
        conversationId,
        content: typeof body.content === 'string' ? body.content : '',
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
      },
    );

    await this.directMessagesGateway.broadcastMessageCreated(
      session.user.id,
      conversationId,
      message,
    );

    return {
      ok: true as const,
      message,
    };
  }

  @Post('conversations/:conversationId/audio')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 25 * 1024 * 1024,
      },
    }),
  )
  async sendAudioMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @UploadedFile() file?: MulterFile,
    @Body() body: Record<string, unknown> = {},
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    const message = await this.directMessagesService.sendAudioMessage(
      session.user.id,
      {
        conversationId,
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
        durationMs:
          typeof body.durationMs === 'string' && body.durationMs.trim() !== ''
            ? Number(body.durationMs)
            : undefined,
        forwarded: body.forwarded === true || body.forwarded === 'true',
      },
      file as MulterFile,
    );

    await this.directMessagesGateway.broadcastMessageCreated(
      session.user.id,
      conversationId,
      message,
    );

    return {
      ok: true as const,
      message,
    };
  }

  @Post('conversations/:conversationId/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async sendImageMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @UploadedFile() file?: MulterFile,
    @Body() body: Record<string, unknown> = {},
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    const message = await this.directMessagesService.sendImageMessage(
      session.user.id,
      {
        conversationId,
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
        forwarded: body.forwarded === true || body.forwarded === 'true',
      },
      file as MulterFile,
    );

    await this.directMessagesGateway.broadcastMessageCreated(
      session.user.id,
      conversationId,
      message,
    );

    return {
      ok: true as const,
      message,
    };
  }

  @Post('conversations/:conversationId/link')
  async sendLinkMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Body() body: Record<string, unknown> = {},
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );

    if (!session) {
      return { ok: false as const, message: 'Sessão não encontrada.' };
    }

    const message = await this.directMessagesService.sendLinkMessage(
      session.user.id,
      {
        conversationId,
        url: typeof body.url === 'string' ? body.url : '',
        label: typeof body.label === 'string' ? body.label : undefined,
        clientMessageId:
          typeof body.clientMessageId === 'string'
            ? body.clientMessageId
            : undefined,
        replyToMessageId:
          typeof body.replyToMessageId === 'string'
            ? body.replyToMessageId
            : undefined,
      },
    );

    await this.directMessagesGateway.broadcastMessageCreated(
      session.user.id,
      conversationId,
      message,
    );

    return {
      ok: true as const,
      message,
    };
  }

  @Patch('conversations/:conversationId/messages/:messageId')
  async editMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @Body() body: Record<string, unknown>,
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );
    if (!session)
      return { ok: false as const, message: 'Sessão não encontrada.' };

    const message = await this.directMessagesService.editMessage(
      session.user.id,
      conversationId,
      messageId,
      typeof body.content === 'string' ? body.content : '',
    );
    await this.directMessagesGateway.broadcastMessageEdited(
      conversationId,
      message,
    );
    return { ok: true as const, message };
  }

  @Delete('conversations/:conversationId/messages/:messageId')
  async deleteMessage(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const session = await this.authService.resolveSession(
      extractSessionToken(req),
    );
    if (!session)
      return { ok: false as const, message: 'Sessão não encontrada.' };

    await this.directMessagesService.deleteMessage(
      session.user.id,
      conversationId,
      messageId,
    );
    await this.directMessagesGateway.broadcastMessageDeleted(
      conversationId,
      messageId,
    );
    return { ok: true as const };
  }
}
