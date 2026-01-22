import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { PassengerEntity } from '../entities/passenger.entity';
import { DriverEntity } from '../entities/driver.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([PassengerEntity, DriverEntity]),
        PassportModule
    ],
    controllers: [AuthController],
    providers: [AuthService, GoogleStrategy],
    exports: [AuthService]
})
export class AuthModule { }
