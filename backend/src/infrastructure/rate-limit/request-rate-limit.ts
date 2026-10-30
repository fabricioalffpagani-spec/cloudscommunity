import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { createClient, type RedisClientType } from 'redis';

type RateLimitRule = { limit: number; windowSeconds: number };

const DEFAULT_RULE: RateLimitRule = { limit: 240, windowSeconds: 60 };
const AUTH_RULE: RateLimitRule = { limit: 12, windowSeconds: 60 };
const WRITE_RULE: RateLimitRule = { limit: 90, windowSeconds: 60 };

function ruleFor(request: Request): RateLimitRule {
  if (
    request.path.startsWith('/auth/login') ||
    request.path.startsWith('/auth/signup') ||
    request.path.startsWith('/auth/guest') ||
    request.path.includes('password-reset')
  ) {
    return AUTH_RULE;
  }
  return ['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)
    ? WRITE_RULE
    : DEFAULT_RULE;
}

function clientKey(request: Request) {
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function routeKey(request: Request) {
  // Resource identifiers must not become part of the bucket. Otherwise a client
  // could bypass a limit simply by issuing requests against different ids.
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(request.method)) {
    return 'write';
  }

  return request.path.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ':id',
  );
}

export async function createRateLimitMiddleware() {
  const logger = new Logger('RateLimit');
  const endpoint = process.env.CACHE_NODE_ENDPOINT?.trim();
  let client: RedisClientType | null = null;

  if (endpoint) {
    client = createClient({ url: endpoint });
    client.on('error', (error) =>
      logger.error(`Redis rate-limit error: ${String(error)}`),
    );
    try {
      await client.connect();
    } catch (error) {
      logger.error(`Rate limiting is unavailable: ${String(error)}`);
      client = null;
    }
  }

  return async (request: Request, response: Response, next: NextFunction) => {
    if (!client || request.method === 'OPTIONS' || request.path === '/health') {
      next();
      return;
    }

    const rule = ruleFor(request);
    const bucket = Math.floor(Date.now() / (rule.windowSeconds * 1000));
    const key = `clouds:rate-limit:${request.method}:${routeKey(request)}:${clientKey(request)}:${bucket}`;

    try {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, rule.windowSeconds);
      response.setHeader('X-RateLimit-Limit', String(rule.limit));
      response.setHeader(
        'X-RateLimit-Remaining',
        String(Math.max(0, rule.limit - count)),
      );
      if (count > rule.limit) {
        response.setHeader('Retry-After', String(rule.windowSeconds));
        response.status(429).json({
          message: 'Muitas solicitações. Tente novamente em instantes.',
        });
        return;
      }
    } catch (error) {
      logger.error(`Rate-limit check failed: ${String(error)}`);
    }

    next();
  };
}
