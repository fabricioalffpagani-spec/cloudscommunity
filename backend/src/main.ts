import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getPort } from './shared/runtime-env';
import * as express from 'express';

async function bootstrap() {
  // Disable built-in body parser so we can set our own limit
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Register body parsers with a higher limit before any route handlers
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  const origins = process.env.APP_WEB_ORIGIN?.trim()
    ? process.env.APP_WEB_ORIGIN.split(',').map((origin) => origin.trim())
    : true;

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  const port = getPort(process.env.APP_HTTP_PORT ?? process.env.PORT, 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();
