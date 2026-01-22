import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { DriverService } from './driver.service';
import { DriverLoginDto, DriverOnlineDto, TripActionDto, DriverRegisterDto } from './dtos';
import { AuthGuard, RolesGuard } from './common/guards';
import { Roles } from './common/decorators';

@Controller('driver')
export class DriverController {
  constructor(private readonly driverService: DriverService) {}

  @Post('login')
  async login(@Body() body: DriverLoginDto) {
    return this.driverService.login(body.phoneNumber, body.pin);
  }

  @Post('register')
  async register(@Body() body: DriverRegisterDto) {
    return this.driverService.register(body);
  }

  @Post('online')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('DRIVER')
  async goOnline(@Body() body: DriverOnlineDto) {
    return this.driverService.goOnline(body);
  }

  @Get('queue-status')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('DRIVER')
  async getQueueStatus(@Query('driverId') driverId: string) {
    return this.driverService.getQueueStatus(driverId);
  }
}

@Controller('trip')
@UseGuards(AuthGuard, RolesGuard)
export class TripController {
  constructor(private readonly driverService: DriverService) {}

  @Post('accept')
  @Roles('DRIVER')
  async acceptTrip(@Body() body: TripActionDto) {
    // Idempotency is handled inside service via Redis Locks
    return this.driverService.acceptTrip(body);
  }

  @Post('reject')
  @Roles('DRIVER')
  async rejectTrip(@Body() body: TripActionDto) {
    return this.driverService.rejectTrip(body);
  }

  @Post('complete')
  @Roles('DRIVER')
  async completeTrip(@Body() body: TripActionDto) {
    return this.driverService.completeTrip(body);
  }
}
