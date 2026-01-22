import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PromotionService } from './promotion.service';
import { DriverService } from './driver.service';
import { OverrideQueueDto, DateRangeDto, DailyCloseDto, CreateInviteCodeDto } from './dtos';
import { AuthGuard, RolesGuard } from './common/guards';
import { Roles } from './common/decorators';

@Controller('admin')
@UseGuards(AuthGuard, RolesGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly promotionService: PromotionService,
    private readonly driverService: DriverService
  ) { }

  @Get('queue')
  @Roles('ADMIN')
  async getQueue(@Query('winId') winId: string) {
    return this.adminService.getQueue(winId);
  }

  @Post('override')
  @Roles('ADMIN')
  async overrideQueue(@Body() body: OverrideQueueDto) {
    return this.adminService.overrideQueue(body);
  }

  @Get('report')
  @Roles('ADMIN')
  async getReport(@Query() query: DateRangeDto) {
    return this.adminService.getReport(query.startDate, query.endDate);
  }

  @Get('financial-stats')
  @Roles('ADMIN')
  async getFinancialStats() {
    return this.adminService.getFinancialStats();
  }

  @Post('daily-close')
  @Roles('ADMIN')
  async performDailyClose(@Body() body: DailyCloseDto) {
    return this.adminService.performDailyClose(body);
  }

  @Post('analyze-promotions')
  @Roles('ADMIN')
  async analyzePromotions() {
    return this.promotionService.analyzePromotions();
  }

  // --- Invite Code Management ---

  @Post('invite-codes')
  @Roles('ADMIN')
  async createInviteCode(@Body() body: CreateInviteCodeDto) {
    return this.driverService.createInviteCode(body);
  }

  @Get('invite-codes')
  @Roles('ADMIN')
  async getInviteCodes() {
    return this.driverService.getAllInviteCodes();
  }

  // --- Driver Approval Management ---

  @Get('drivers/pending')
  @Roles('ADMIN')
  async getPendingDrivers() {
    return this.adminService.getPendingDrivers();
  }

  @Post('drivers/approve')
  @Roles('ADMIN')
  async approveDriver(@Body() body: { driverId: string }) {
    return this.adminService.approveDriver(body.driverId);
  }

  @Post('drivers/reject')
  @Roles('ADMIN')
  async rejectDriver(@Body() body: { driverId: string, reason: string }) {
    return this.adminService.rejectDriver(body.driverId, body.reason);
  }
}
