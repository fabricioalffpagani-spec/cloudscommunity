import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
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
  async search(
    @Req() req: Request,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.search(
      extractSessionToken(req),
      q ?? '',
      limit ?? null,
    );
  }

  @Get('search-history')
  async searchHistory(@Req() req: Request) {
    return this.usersService.getSearchHistory(extractSessionToken(req));
  }

  @Post('search-history')
  async saveSearchHistory(
    @Req() req: Request,
    @Body()
    body: {
      query?: string;
      kind?: string;
      targetId?: string;
      subtitle?: string;
      avatarUrl?: string | null;
    },
  ) {
    return this.usersService.saveSearchHistory(extractSessionToken(req), body);
  }

  @Delete('search-history')
  async clearSearchHistory(
    @Req() req: Request,
    @Query('kind') kind?: string,
    @Query('targetId') targetId?: string,
  ) {
    return kind && targetId
      ? this.usersService.deleteSearchHistory(
          extractSessionToken(req),
          kind,
          targetId,
        )
      : this.usersService.clearSearchHistory(extractSessionToken(req));
  }

  @Get('following')
  async following(
    @Req() req: Request,
    @Query('sort') sort?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.following(extractSessionToken(req), sort, limit);
  }

  @Get('nearby')
  async nearby(@Req() req: Request) {
    return this.usersService.getNearbyUsers(extractSessionToken(req));
  }

  @Get('meet')
  async meet(@Req() req: Request) {
    return this.usersService.meet(extractSessionToken(req));
  }

  @Get('invite-contacts')
  async inviteContacts(@Req() req: Request) {
    return this.usersService.getInviteContacts(extractSessionToken(req));
  }

  @Post('send-invite')
  async sendInvite(@Req() req: Request, @Body() body: { identifier: string }) {
    return this.usersService.sendInvite(
      extractSessionToken(req),
      body.identifier,
    );
  }

  @Get(':identifier')
  async profile(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.getProfile(extractSessionToken(req), identifier);
  }

  @Get(':identifier/followers')
  async followers(
    @Req() req: Request,
    @Param('identifier') identifier: string,
  ) {
    return this.usersService.getFollowers(extractSessionToken(req), identifier);
  }

  @Get(':identifier/following')
  async getUserFollowing(
    @Req() req: Request,
    @Param('identifier') identifier: string,
  ) {
    return this.usersService.getUserFollowing(
      extractSessionToken(req),
      identifier,
    );
  }

  @Get(':identifier/hypes')
  async receivedHypes(
    @Req() req: Request,
    @Param('identifier') identifier: string,
  ) {
    return this.usersService.getReceivedHypes(
      extractSessionToken(req),
      identifier,
    );
  }

  @Post(':identifier/follow')
  async follow(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.follow(extractSessionToken(req), identifier);
  }

  @Post(':identifier/follow/accept')
  async acceptFollow(
    @Req() req: Request,
    @Param('identifier') identifier: string,
  ) {
    return this.usersService.acceptFollowRequest(
      extractSessionToken(req),
      identifier,
    );
  }

  @Post(':identifier/follow/decline')
  async declineFollow(
    @Req() req: Request,
    @Param('identifier') identifier: string,
  ) {
    return this.usersService.declineFollowRequest(
      extractSessionToken(req),
      identifier,
    );
  }

  @Delete(':identifier/follow')
  async unfollow(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.unfollow(extractSessionToken(req), identifier);
  }

  @Post(':identifier/block')
  async block(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.block(extractSessionToken(req), identifier);
  }

  @Delete(':identifier/block')
  async unblock(@Req() req: Request, @Param('identifier') identifier: string) {
    return this.usersService.unblock(extractSessionToken(req), identifier);
  }

  @Delete(':identifier/followers/:followerId')
  async removeFollower(
    @Req() req: Request,
    @Param('identifier') identifier: string,
    @Param('followerId') followerId: string,
  ) {
    return this.usersService.removeFollower(
      extractSessionToken(req),
      identifier,
      followerId,
    );
  }
}
