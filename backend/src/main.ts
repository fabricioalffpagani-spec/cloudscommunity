import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { getPort } from './shared/runtime-env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
