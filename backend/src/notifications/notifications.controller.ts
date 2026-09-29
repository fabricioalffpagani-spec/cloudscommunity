import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SESSION_COOKIE_NAME } from '../auth/auth.constants';
import { NotificationsService } from './notifications.service';

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

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() req: Request, @Query('all') all?: string) {
    return this.notificationsService.list(
      extractSessionToken(req),
      all === 'true',
    );
  }

  @Post('read')
  async markAllAsRead(@Req() req: Request) {
    return this.notificationsService.markAllAsRead(extractSessionToken(req));
  }

  @Get('push-key')
  async pushKey(@Req() req: Request) {
    return this.notificationsService.pushPublicKey(extractSessionToken(req));
  }

  @Post('push-subscriptions')
  async subscribe(
    @Req() req: Request,
    @Body()
    subscription: {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    },
  ) {
    return this.notificationsService.savePushSubscription(
      extractSessionToken(req),
      subscription,
    );
  }

  @Post(':id/accept')
  async accept(@Req() req: Request, @Param('id') id: string) {
    return this.notificationsService.acceptFollowRequest(
      extractSessionToken(req),
      id,
    );
  }

  @Post(':id/decline')
  async decline(@Req() req: Request, @Param('id') id: string) {
    return this.notificationsService.declineFollowRequest(
      extractSessionToken(req),
      id,
    );
  }
}
