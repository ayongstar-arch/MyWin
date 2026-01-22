import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { PassengerService } from './passenger.service';
import { RideRequestDto, PassengerRequestOtpDto, PassengerVerifyOtpDto, PassengerRegisterDto } from './dtos';
import { AuthGuard, RolesGuard } from './common/guards';
import { Roles } from './common/decorators';

@Controller('passenger')
export class PassengerController {
  constructor(private readonly passengerService: PassengerService) { }

  // --- PUBLIC ENDPOINTS (No Auth Required) ---

  @Post('request-otp')
  async requestOtp(@Body() body: PassengerRequestOtpDto) {
    return this.passengerService.requestOtp(body.phoneNumber);
  }

  @Post('login')
  async login(@Body() body: PassengerVerifyOtpDto) {
    return this.passengerService.login(body.phoneNumber, body.otp);
  }

  @Post('register')
  async register(@Body() body: PassengerRegisterDto) {
    return this.passengerService.register(body);
  }

  // --- PROTECTED ENDPOINTS (Auth Required) ---

  @Get('profile')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PASSENGER')
  async getProfile(@Query('passengerId') passengerId: string) {
    return this.passengerService.getProfile(passengerId);
  }
}

@Controller('ride')
export class RideController {
  constructor(private readonly passengerService: PassengerService) { }

  @Post('request')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('PASSENGER')
  async requestRide(@Body() body: RideRequestDto) {
    return this.passengerService.requestRide(body);
  }

  @Get('status')
  async getStatus(@Query('tripId') tripId: string) {
    return this.passengerService.getRideStatus(tripId);
  }
}
