import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { RedisIoAdapter } from './redis-io.adapter';
import * as compression from 'compression'; // You might need to install: npm i compression

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Enable GZIP Compression (Save Bandwidth)
  // @ts-ignore
  if (compression) app.use(compression());

  // 2. Global Validation Pipe (Protect DTOs)
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // Strip properties not in DTO
    forbidNonWhitelisted: true, // Throw error if extra props sent
    transform: true, // Auto-transform types
  }));

  // 3. Enable CORS
  app.enableCors({
    origin: true, // Reflect request origin
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // 4. Setup Redis Adapter for Scalable WebSockets
  const redisIoAdapter = new RedisIoAdapter(app);
  try {
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
    logger.log('Redis Adapter for Socket.IO initialized');
  } catch (e) {
    logger.error('Failed to connect to Redis for Socket.IO', e);
    // Fallback to default memory adapter if Redis fails (not recommended for prod)
  }

  // 5. Start Server
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();