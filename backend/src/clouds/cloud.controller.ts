import {
  Body,
  Controller,
  Get,
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

  @Post()
  async create(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.cloudService.create(extractSessionToken(req), {
      title: typeof body.title === 'string' ? body.title : undefined,
      description: typeof body.description === 'string' ? body.description : undefined,
      duration: typeof body.duration === 'string' ? body.duration : undefined,
      visibility: body.visibility === 'private' ? 'private' : 'public',
    } satisfies CreateCloudInput);
  }
}
