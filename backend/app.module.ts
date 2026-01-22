import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'; // Security: Rate Limiting
import { join } from 'path';

import { FairQueueService } from './fair-queue.service';
import { SmsService } from './sms.service';
import { MapService } from './map.service';

import { DriverEntity } from './entities/driver.entity';
import { TripEntity } from './entities/trip.entity';
import { ChatMessageEntity } from './entities/chat.entity';
import { PassengerEntity } from './entities/passenger.entity';

import { AppGateway } from './app.gateway';

import { DriverController, TripController } from './driver.controller';
import { DriverService } from './driver.service';

import { PassengerController, RideController } from './passenger.controller';
import { PassengerService } from './passenger.service';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UploadController } from './common/upload.controller'; // NEW

import { CreditController } from './credit.controller';
import { CreditService } from './credit.service';
import { PromotionService } from './promotion.service';
import { ChatService } from './chat.service';
import { AuthModule } from './auth/auth.module'; // NEW

import { LoggingInterceptor, ResilienceInterceptor } from './common/interceptors';

@Global()
@Module({
  imports: [
    AuthModule, // NEW
    // 1. Config Module
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    // 2. Security: Rate Limiting (Prevent DDoS/Spam)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 100, // Max 100 requests per minute per IP
    }]),

    // 3. JWT Authentication Module
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'secretKey123',
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),

    // 4. Serve React Frontend
    ServeStaticModule.forRoot({
      rootPath: join((process as any).cwd(), 'client_build'),
      exclude: ['/api/(.*)'],
    }),
    ServeStaticModule.forRoot({
      rootPath: join((process as any).cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // 5. Database
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mywin_db',
      entities: [DriverEntity, TripEntity, ChatMessageEntity, PassengerEntity],
      // CRITICAL FOR PRODUCTION: Disable synchronize to prevent data loss
      synchronize: process.env.NODE_ENV !== 'production',
      logging: false,
      extra: { connectionLimit: 20 }, // Increased pool size for high concurrency
      autoLoadEntities: true,
    }),

    TypeOrmModule.forFeature([DriverEntity, TripEntity, ChatMessageEntity, PassengerEntity]),
  ],
  controllers: [
    DriverController,
    TripController,
    PassengerController,
    RideController,
    AdminController,
    AdminController,
    CreditController,
    UploadController // NEW
  ],
  providers: [
    AppGateway,
    FairQueueService,
    SmsService,
    MapService,
    DriverService,
    PassengerService,
    AdminService,
    CreditService,
    PromotionService,
    ChatService,
    // Add Throttler Guard globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResilienceInterceptor },
  ],
  exports: [JwtModule, SmsService, MapService]
})
export class AppModule { }