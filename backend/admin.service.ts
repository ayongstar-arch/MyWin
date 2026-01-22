import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { OverrideQueueDto, DailyCloseDto } from './dtos';
import { DriverEntity } from './entities/driver.entity';

@Injectable()
export class AdminService {
  private redis: Redis;
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(DriverEntity)
    private driverRepo: Repository<DriverEntity>
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async getQueue(winId: string) {
    const drivers = await this.redis.zrevrange(`win:${winId}:queue`, 0, -1, 'WITHSCORES');
    const formatted = [];
    for (let i = 0; i < drivers.length; i += 2) {
      formatted.push({
        driverId: drivers[i],
        score: parseFloat(drivers[i + 1]),
      });
    }
    return formatted;
  }

  async overrideQueue(dto: OverrideQueueDto) {
    await this.redis.zrem(`win:${dto.winId}:queue`, dto.driverId);
    await this.redis.lpush('admin:override:logs', JSON.stringify({
      ...dto,
      timestamp: Date.now()
    }));
    return { success: true, message: `Driver ${dto.driverId} prioritized.` };
  }

  async getReport(startDate: string, endDate: string) {
    return {
      totalTrips: 1540,
      avgWaitTime: 45,
      fairnessScore: 92,
      period: `${startDate} to ${endDate}`
    };
  }

  // --- Financial & Area Reporting ---

  async getFinancialStats() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check if today is "Closed"
    const closedStatus = await this.redis.get(`finance:daily_close:${todayStr}`);
    const isClosed = !!closedStatus;

    // Mock Area Performance Data
    // Logic: Revenue = Rides * 2. Cost = Bonus Points allocated to this area (simulated)
    const areas = [
      { areaId: 'WIN-CENTRAL', areaName: 'Win Central Market', rides: 1200, bonus: 300 },
      { areaId: 'WIN-TECH', areaName: 'Win Tech Park', rides: 850, bonus: 50 },
      { areaId: 'WIN-SUBURB', areaName: 'Win Suburb A', rides: 400, bonus: 200 },
    ];

    const areaPerformance = areas.map(a => {
      const revenue = a.rides * 2; // 2 THB per ride fee
      // In reality, bonus cost is an "Opportunity Cost", 1 Point = 1 THB liability
      const cost = a.bonus;
      return {
        ...a,
        revenue,
        bonusCost: cost,
        grossMargin: revenue - cost
      };
    });

    return {
      isClosed,
      closedBy: isClosed ? JSON.parse(closedStatus).confirmedBy : null,
      overview: {
        date: todayStr,
        cashIn: 12500,        // Cash received via Top-up
        txnCounts: 85,
        pointsSold: 12500,    // Points Issued
        bonusPoints: 1200,    // Marketing Cost
        netRevenue: 12500,    // Cash Revenue
        totalRides: 2450,     // Total Rides System-wide
        rideRevenue: 4900,    // 2450 * 2 (Theoretical Revenue from Usage)
        refundsCount: 2,
        refundsValue: 150,
      },
      areaPerformance,
      transactions: [
        { id: 'TXN-9981', time: '14:30', area: 'WIN-CENTRAL', user: '089-123-4567', amount: 100, method: 'PromptPay', promo: 'TOPUP-50-GET-10', points: 120 },
        { id: 'TXN-9982', time: '14:35', area: 'WIN-TECH', user: '081-999-8888', amount: 50, method: 'PromptPay', promo: 'TOPUP-50-GET-10', points: 60 },
        { id: 'TXN-9983', time: '14:42', area: 'WIN-CENTRAL', user: '062-555-4321', amount: 200, method: 'PromptPay', promo: '-', points: 200 },
        { id: 'TXN-9984', time: '15:01', area: 'WIN-SUBURB', user: '090-111-2222', amount: 50, method: 'PromptPay', promo: 'TOPUP-50-GET-10', points: 60 },
        { id: 'TXN-9985', time: '15:15', area: 'WIN-TECH', user: '088-777-6666', amount: 100, method: 'PromptPay', promo: '-', points: 100 },
      ],
      alerts: [
        { level: 'HIGH', message: 'Refund rate exceeded 2% today (Current: 2.3%)' },
        { level: 'MEDIUM', message: 'Win Suburb A: Gross Margin Low (< 500 THB)' }
      ]
    };
  }

  async performDailyClose(dto: DailyCloseDto) {
    const todayStr = new Date().toISOString().split('T')[0];
    if (dto.date !== todayStr) {
      throw new BadRequestException('Can only close current day.');
    }

    const key = `finance:daily_close:${todayStr}`;
    const existing = await this.redis.get(key);

    if (existing) {
      throw new BadRequestException('Day already closed.');
    }

    // Snapshot the data (In a real DB, we would freeze rows or create a snapshot record)
    // Here we mark the flag in Redis
    await this.redis.set(key, JSON.stringify({
      confirmedBy: dto.confirmedBy,
      closedAt: new Date().toISOString(),
      status: 'SEALED'
    }));

    return { success: true, message: 'Daily stats sealed successfully.' };
  }

  // --- Driver Approval Management ---

  async getPendingDrivers() {
    const drivers = await this.driverRepo.find({
      where: { approval_status: 'PENDING' },
      order: { created_at: 'ASC' }
    });

    return drivers.map(d => ({
      id: d.id,
      name: d.name,
      phone: d.phone,
      plate: d.plate,
      winId: d.winId,
      inviteCode: d.invite_code,
      createdAt: d.created_at
    }));
  }

  async approveDriver(driverId: string) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });

    if (!driver) {
      throw new BadRequestException('ไม่พบข้อมูลคนขับ');
    }

    if (driver.approval_status !== 'PENDING') {
      throw new BadRequestException('คนขับนี้ได้รับการพิจารณาแล้ว');
    }

    await this.driverRepo.update(driverId, { approval_status: 'APPROVED' });

    this.logger.log(`Driver ${driverId} approved`);
    return { success: true, message: 'อนุมัติคนขับสำเร็จ' };
  }

  async rejectDriver(driverId: string, reason: string) {
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });

    if (!driver) {
      throw new BadRequestException('ไม่พบข้อมูลคนขับ');
    }

    if (driver.approval_status !== 'PENDING') {
      throw new BadRequestException('คนขับนี้ได้รับการพิจารณาแล้ว');
    }

    await this.driverRepo.update(driverId, { approval_status: 'REJECTED' });

    await this.redis.lpush('admin:driver:rejections', JSON.stringify({
      driverId,
      reason,
      timestamp: Date.now()
    }));

    this.logger.log(`Driver ${driverId} rejected: ${reason}`);
    return { success: true, message: 'ปฏิเสธคนขับสำเร็จ' };
  }
}
