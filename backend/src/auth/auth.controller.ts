import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SocketTicketService } from './socket-ticket.service';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { clearSessionCookie, setSessionCookie } from './auth.utils';
import { GoogleAuthService } from './google-auth.service';

const GOOGLE_STATE_COOKIE = 'cc_google_oauth_state';
const GOOGLE_PENDING_COOKIE = 'cc_google_pending';

function extractSessionToken(req: Request): string | null {
  return extractCookie(req, SESSION_COOKIE_NAME);
}

function extractCookie(req: Request, cookieName: string): string | null {
  const rawCookie = req.headers.cookie ?? '';
  const cookiePairs = rawCookie.split(';');

  for (const pair of cookiePairs) {
    const [name, ...rest] = pair.split('=');
    if (name?.trim() === cookieName) {
      return rest.join('=').trim() || null;
    }
  }

  return null;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService,
    private readonly socketTicketService: SocketTicketService,
  ) {}

  @Get('google/start')
  async googleStart(
    @Query('returnTo') returnTo: string | undefined,
    @Query('intent') intent: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.googleAuthService.start(
      returnTo,
      intent,
      extractSessionToken(req),
    );
    res.cookie(GOOGLE_STATE_COOKIE, result.state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/google/callback',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(302, result.authorizationUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = await this.googleAuthService.callback({
      state,
      cookieState: extractCookie(req, GOOGLE_STATE_COOKIE) ?? undefined,
      code,
      error,
      meta: {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: '/api/auth/google/callback' });
    if (result.pendingToken) {
      res.cookie(GOOGLE_PENDING_COOKIE, result.pendingToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/api/auth/google',
        maxAge: 15 * 60 * 1000,
      });
    }
    if (result.sessionToken && result.sessionExpiresAt) {
      setSessionCookie(res, result.sessionToken, result.sessionExpiresAt);
    }
    res.redirect(302, result.redirectTo);
  }

  @Post('google/register')
  async googleRegister(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleAuthService.completeRegistration(
      extractCookie(req, GOOGLE_PENDING_COOKIE),
      {
        name: typeof body.name === 'string' ? body.name : undefined,
        username: typeof body.username === 'string' ? body.username : undefined,
        birthDate:
          typeof body.birthDate === 'string' ? body.birthDate : undefined,
        acceptedTerms: body.acceptedTerms === true,
        acceptedCommunityRules: body.acceptedCommunityRules === true,
      },
      {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    );
    setSessionCookie(res, result.token, result.expiresAt);
    res.clearCookie(GOOGLE_PENDING_COOKIE, { path: '/api/auth/google' });
    return { ok: true as const, returnTo: result.returnTo };
  }

  @Get('google/pending-registration')
  googlePendingRegistration(@Req() req: Request) {
    return this.googleAuthService.pendingRegistration(
      extractCookie(req, GOOGLE_PENDING_COOKIE),
    );
  }

  @Post('google/link')
  async googleLink(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.googleAuthService.completeLink(
      extractCookie(req, GOOGLE_PENDING_COOKIE),
      typeof body.password === 'string' ? body.password : undefined,
      {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    );
    setSessionCookie(res, result.token, result.expiresAt);
    res.clearCookie(GOOGLE_PENDING_COOKIE, { path: '/api/auth/google' });
    return { ok: true as const, returnTo: result.returnTo };
  }

  @Get('google/status')
  googleStatus(@Req() req: Request) {
    return this.googleAuthService.status(extractSessionToken(req));
  }

  @Delete('google')
  unlinkGoogle(@Req() req: Request) {
    return this.googleAuthService.unlink(extractSessionToken(req));
  }

  @Get('socket-ticket')
  async socketTicket(@Req() req: Request) {
    const ticket = await this.socketTicketService.issue(
      extractSessionToken(req),
    );
    if (!ticket)
      return { ok: false as const, message: 'Sessão não encontrada.' };
    return { ok: true as const, ticket };
  }

  @Post('signup')
  async signup(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const result = await this.authService.signup(
      {
        email: typeof body.email === 'string' ? body.email : undefined,
        name: typeof body.name === 'string' ? body.name : undefined,
        username: typeof body.username === 'string' ? body.username : undefined,
        password: typeof body.password === 'string' ? body.password : undefined,
        birthDate:
          typeof body.birthDate === 'string' ? body.birthDate : undefined,
        bio: typeof body.bio === 'string' ? body.bio : undefined,
        location: typeof body.location === 'string' ? body.location : undefined,
        region: typeof body.region === 'string' ? body.region : undefined,
        acceptedTerms: body.acceptedTerms === true,
        acceptedCommunityRules: body.acceptedCommunityRules === true,
        returnTo: typeof body.returnTo === 'string' ? body.returnTo : undefined,
        invitationCode:
          typeof body.invitationCode === 'string'
            ? body.invitationCode
            : undefined,
      },
      {
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    );

    return result;
  }

  @Post('email-verification/resend')
  async resendEmailVerification(@Body() body: Record<string, unknown>) {
    return this.authService.resendEmailVerification(
      typeof body.email === 'string' ? body.email : '',
    );
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() body: Record<string, unknown>) {
    return this.authService.requestPasswordReset(
      typeof body.email === 'string' ? body.email : '',
    );
  }

  @Post('password-reset/confirm')
  async resetPassword(@Body() body: Record<string, unknown>) {
    return this.authService.resetPassword(
      typeof body.token === 'string' ? body.token : '',
      typeof body.password === 'string' ? body.password : '',
    );
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
    const result = await this.authService.verifyEmail(token ?? '', {
      ipAddress: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });

    const { token: sessionToken, ...payload } = result;
    setSessionCookie(res, sessionToken, new Date(payload.session.expiresAt));
    return payload;
  }

  @Post('login')
  async login(
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ) {
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
        rememberDevice: body.rememberDevice === true,
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

  @Delete('me')
  async deleteMe(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.deleteAccount(extractSessionToken(req));
    clearSessionCookie(res);
    return { ok: true as const };
  }

  @Patch('me')
  async updateMe(@Body() body: Record<string, unknown>, @Req() req: Request) {
    return this.authService.updateProfile(extractSessionToken(req), {
      displayName:
        typeof body.displayName === 'string' ? body.displayName : undefined,
      bio: typeof body.bio === 'string' ? body.bio : undefined,
      location: typeof body.location === 'string' ? body.location : undefined,
      avatarUrl:
        typeof body.avatarUrl === 'string' ? body.avatarUrl : undefined,
      isPrivate:
        typeof body.isPrivate === 'boolean' ? body.isPrivate : undefined,
      showHypesCount:
        typeof body.showHypesCount === 'boolean'
          ? body.showHypesCount
          : undefined,
      showArchivedClouds:
        typeof body.showArchivedClouds === 'boolean'
          ? body.showArchivedClouds
          : undefined,
      showParticipatingNow:
        typeof body.showParticipatingNow === 'boolean'
          ? body.showParticipatingNow
          : undefined,
      interests: Array.isArray(body.interests)
        ? body.interests.filter(
            (interest): interest is string => typeof interest === 'string',
          )
        : undefined,
    });
  }

  @Post('me/change-password')
  async changePassword(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.changePassword(extractSessionToken(req), {
      currentPassword:
        typeof body.currentPassword === 'string'
          ? body.currentPassword
          : undefined,
      newPassword:
        typeof body.newPassword === 'string' ? body.newPassword : undefined,
    });
  }

  @Post('feedback')
  async sendFeedback(
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.authService.sendFeedback(
      extractSessionToken(req),
      typeof body.message === 'string' ? body.message : '',
    );
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
