import { Controller, Delete, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';

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

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('search')
  async search(@Req() req: Request, @Query('q') q?: string, @Query('limit') limit?: string) {
    return this.usersService.search(extractSessionToken(req), q ?? '', limit ?? null);
  }

  @Get('following')
  async following(@Req() req: Request) {
    return this.usersService.following(extractSessionToken(req));
  }

  @Get(':identifier')
  async profile(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.getProfile(extractSessionToken(req), identifier);
  }

  @Post(':identifier/follow')
  async follow(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.follow(extractSessionToken(req), identifier);
  }

  @Delete(':identifier/follow')
  async unfollow(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.unfollow(extractSessionToken(req), identifier);
  }
}
