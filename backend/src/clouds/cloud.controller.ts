import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
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
    return this.cloudService.createMessage(extractSessionToken(req), id, body);
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string, @Req() req: Request) {
    return this.cloudService.getMessages(extractSessionToken(req), id);
  }
}
