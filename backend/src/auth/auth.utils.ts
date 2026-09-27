import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import type { Response } from 'express';
import {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE_NAME,
  USERNAME_PATTERN,
} from './auth.constants';

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
};

export type FieldErrors = Record<string, string>;

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function normalizeName(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function normalizeOptionalText(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function parseBirthDate(value: string): Date {
  const normalized = value.trim();

  if (!normalized) {
    throw new BadRequestException({
      message: 'Data de nascimento obrigatória.',
      fieldErrors: { birthDate: 'Informe sua data de nascimento.' },
    });
  }

  const parts = normalized.split('-').map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) {
    throw new BadRequestException({
      message: 'Data de nascimento inválida.',
      fieldErrors: { birthDate: 'Data de nascimento inválida.' },
    });
  }

  const [year, month, day] = parts;
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException({
      message: 'Data de nascimento inválida.',
      fieldErrors: { birthDate: 'Data de nascimento inválida.' },
    });
  }

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new BadRequestException({
      message: 'Data de nascimento inválida.',
      fieldErrors: { birthDate: 'Data de nascimento inválida.' },
    });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  parsed.setHours(0, 0, 0, 0);

  if (parsed > today) {
    throw new BadRequestException({
      message: 'Data de nascimento não pode ser no futuro.',
      fieldErrors: {
        birthDate: 'A data de nascimento não pode ser no futuro.',
      },
    });
  }

  return parsed;
}

export function validateMinimumAge(
  birthDate: Date,
  minimumAge = 16,
  maximumAge = 100,
): void {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();

  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  ) {
    age -= 1;
  }

  if (age < minimumAge) {
    throw new BadRequestException({
      message: 'Idade mínima não atendida.',
      fieldErrors: {
        birthDate:
          'Você precisa ter pelo menos 16 anos completos para participar do Clouds.',
      },
    });
  }

  if (age > maximumAge) {
    throw new BadRequestException({
      message: 'Idade máxima excedida.',
      fieldErrors: {
        birthDate: `A idade máxima permitida é de ${maximumAge} anos.`,
      },
    });
  }
}

export function formatDateOnly(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validatePassword(password: string): void {
  const trimmed = password ?? '';

  if (trimmed.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException({
      message: 'Senha muito curta.',
      fieldErrors: {
        password: `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
      },
    });
  }

  if (
    !/[a-zA-Z]/.test(trimmed) ||
    !/[0-9]/.test(trimmed) ||
    !/[^a-zA-Z0-9\s]/.test(trimmed)
  ) {
    throw new BadRequestException({
      message: 'Senha fraca.',
      fieldErrors: {
        password:
          'A senha deve conter letras, números e um caractere especial.',
      },
    });
  }
}

export function validateUsername(username: string): string {
  const normalized = normalizeUsername(username);

  if (!USERNAME_PATTERN.test(normalized)) {
    throw new BadRequestException({
      message: 'Nome de usuário inválido.',
      fieldErrors: {
        username: 'Use de 4 a 15 caracteres com letras, números ou _.',
      },
    });
  }

  return normalized;
}

export function validateEmail(email: string): string {
  const normalized = normalizeEmail(email);
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!basicEmailPattern.test(normalized)) {
    throw new BadRequestException({
      message: 'Email inválido.',
      fieldErrors: { email: 'Digite um email válido.' },
    });
  }

  return normalized;
}

export function createPasswordHash(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, salt, hash] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const computed = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');

  if (expected.length !== computed.length) {
    return false;
  }

  return timingSafeEqual(expected, computed);
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getSessionCookieOptions(expiresAt: Date) {
  const secure = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    domain: process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
    maxAge: Math.max(1, expiresAt.getTime() - Date.now()),
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
  expiresAt: Date,
) {
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

export function clearSessionCookie(res: Response) {
  res.cookie(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    domain: process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getRequestMeta(headers: {
  get(name: string): string | null | undefined;
  ip?: string | null;
}): RequestMeta {
  const forwardedFor =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  return {
    ipAddress: forwardedFor || headers.ip || null,
    userAgent: headers.get('user-agent') ?? null,
  };
}

export function makeAuthConflict(fieldErrors: FieldErrors, message: string) {
  throw new ConflictException({
    message,
    fieldErrors,
  });
}

export function makeAuthUnauthorized(
  fieldErrors: FieldErrors,
  message: string,
) {
  throw new UnauthorizedException({
    message,
    fieldErrors,
  });
}
