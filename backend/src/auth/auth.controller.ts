import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { clearSessionCookie, setSessionCookie } from './auth.utils';

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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const result = await this.authService.signup(
      {
        email: typeof body.email === 'string' ? body.email : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
        username: typeof body.username === 'string' ? body.username : undefined,
        password: typeof body.password === 'string' ? body.password : undefined,
        birthDate: typeof body.birthDate === 'string' ? body.birthDate : undefined,
        bio: typeof body.bio === 'string' ? body.bio : undefined,
        location: typeof body.location === 'string' ? body.location : undefined,
        region: typeof body.region === 'string' ? body.region : undefined,
      },
      {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    );

    const { token, ...payload } = result;
    setSessionCookie(res, token, new Date(payload.session.expiresAt));
    return payload;
  }

  @Post('login')
  async login(@Body() body: Record<string, unknown>, @Res({ passthrough: true }) res: Response, @Req() req: Request) {
    const result = await this.authService.login(
      {
        identifier:
          typeof body.identifier === 'string'
            ? body.identifier
            : typeof body.email === 'string'
              ? body.email
              : typeof body.username === 'string'
                ? body.username
                : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        username: typeof body.username === 'string' ? body.username : undefined,
        password: typeof body.password === 'string' ? body.password : undefined,
      },
      {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    );

    const { token, ...payload } = result;
    setSessionCookie(res, token, new Date(payload.session.expiresAt));
    return payload;
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractSessionToken(req);
    await this.authService.logout(token);
    clearSessionCookie(res);
    return { ok: true as const };
  }

  @Get('me')
  async me(@Req() req: Request) {
    return this.authService.me(extractSessionToken(req));
  }

  @Patch('me')
  async updateMe(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.authService.updateProfile(extractSessionToken(req), {
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      location: typeof body.location === 'string' ? body.location : undefined,
      avatarUrl: typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
      isPrivate: typeof body.isPrivate === 'boolean' ? body.isPrivate : undefined,
    });
  }

  @Post('me/change-password')
  async changePassword(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.authService.changePassword(extractSessionToken(req), {
      currentPassword: typeof body.currentPassword === 'string' ? body.currentPassword : undefined,
      newPassword: typeof body.newPassword === 'string' ? body.newPassword : undefined,
    });
  }

  @Get('session')
  async session(@Req() req: Request) {
    return this.authService.session(extractSessionToken(req));
  }

  @Get('username-availability')
  async usernameAvailability(@Query('username') username: string) {
    return this.authService.usernameAvailability(username ?? '');
  }

  @Get('email-availability')
  async emailAvailability(@Query('email') email: string) {
    return this.authService.emailAvailability(email ?? '');
  }
}
