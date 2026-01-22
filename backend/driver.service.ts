import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { FairQueueService } from './fair-queue.service';
import { SmsService } from './sms.service'; // ADDED
import { CreditService } from './credit.service';
import { DriverOnlineDto, TripActionDto, DriverRegisterDto, CreateInviteCodeDto, InviteCode } from './dtos';
import { DriverEntity } from './entities/driver.entity';
import { TripEntity } from './entities/trip.entity';

@Injectable()
export class DriverService implements OnModuleInit {
  private redis: Redis;
  private readonly logger = new Logger(DriverService.name);

  // Invite Codes 
  private inviteCodes = new Map<string, InviteCode>();

  // WIN MASTER DATA 
  private stations = new Map<string, { id: string, name: string, lat: number, lng: number, radius: number }>();

  constructor(
    @InjectRepository(DriverEntity)
    private driverRepo: Repository<DriverEntity>,
    @InjectRepository(TripEntity)
    private tripRepo: Repository<TripEntity>,
    private fairQueueService: FairQueueService,
    private creditService: CreditService,
    private jwtService: JwtService,
    private smsService: SmsService // ADDED
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

    // Seed Stations (Example)
    this.stations.set('WIN-CENTRAL-01', { id: 'WIN-CENTRAL-01', name: 'วินตลาดกลาง', lat: 13.7563, lng: 100.5018, radius: 100 });
    this.stations.set('WIN-TECH-PARK', { id: 'WIN-TECH-PARK', name: 'วินเทคพาร์ค', lat: 13.7663, lng: 100.5118, radius: 100 });

    // Seed default invites
    this.inviteCodes.set('WIN888', {
      code: 'WIN888',
      winId: 'WIN-CENTRAL-01',
      type: 'STATION',
      maxUses: 100,
      usedCount: 0,
      expiresAt: '2025-12-31T23:59:59Z',
      note: 'Default code',
      createdBy: 'ADMIN',
      isActive: true
    });
  }

  async onModuleInit() {
    // Seed Demo User
    const demoUser = await this.driverRepo.findOne({ where: { phone: '0812345678' } });
    if (!demoUser) {
      await this.driverRepo.save({
        id: 'D-USER',
        phone: '0812345678',
        name: 'Somchai Rider',
        plate: '1กข-9999',
        invite_code: 'WIN888',
        winId: 'WIN-CENTRAL-01',
        approval_status: 'APPROVED',
        current_status: 'OFFLINE'
      });
      this.logger.log('Seeded Demo Driver D-USER');
    }
  }

  // --- Invite Code Management ---
  createInviteCode(dto: CreateInviteCodeDto) {
    if (this.inviteCodes.has(dto.code)) {
      throw new BadRequestException('Code already exists');
    }
    const newCode: InviteCode = { ...dto, usedCount: 0, createdBy: 'ADMIN', isActive: true };
    this.inviteCodes.set(dto.code, newCode);
    return newCode;
  }

  getAllInviteCodes() {
    return Array.from(this.inviteCodes.values());
  }

  // --- CORE LOGIC: Resolve Station by Location ---
  private findNearestStation(lat: number, lng: number): string | null {
    const THRESHOLD_METERS = 100; // 100m Radius
    for (const station of this.stations.values()) {
      const dist = this.calculateDistanceMeters(lat, lng, station.lat, station.lng);
      if (dist <= THRESHOLD_METERS) return station.id;
    }
    return null;
  }

  private calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- REAL AUTHENTICATION LOGIC ---

  async requestOtp(phoneNumber: string) {
    // 1. Generate 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Store in Redis (Expire in 5 minutes)
    const key = `otp:${phoneNumber}`;
    await this.redis.set(key, otp, 'EX', 300);

    // 3. Send via Real SMS Service
    await this.smsService.sendOtp(phoneNumber, otp);

    return { success: true, message: 'OTP sent successfully' };
  }

  async login(phoneNumber: string, otp: string) {
    const key = `otp:${phoneNumber}`;
    const storedOtp = await this.redis.get(key);

    const isTestAccount = otp === '1234' && process.env.ALLOW_TEST_OTP === 'true';

    if (!isTestAccount && storedOtp !== otp) {
      throw new UnauthorizedException('รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
    }

    if (!isTestAccount) await this.redis.del(key);

    const driver = await this.driverRepo.findOne({ where: { phone: phoneNumber } });

    if (!driver) {
      return { isRegistered: false };
    }

    if (driver.approval_status === 'PENDING') {
      return { isRegistered: true, isApproved: false, driverId: driver.id };
    }

    const payload = { sub: driver.id, role: 'DRIVER', phone: driver.phone };
    const token = this.jwtService.sign(payload);

    return {
      isRegistered: true,
      isApproved: true,
      token: token,
      driverId: driver.id,
      name: driver.name,
      winId: driver.winId,
      hasPin: !!driver.pin_hash, // New: Return PIN status
      profilePic: driver.profile_pic_url
    };
  }

  async register(dto: DriverRegisterDto) {
    const invite = this.inviteCodes.get(dto.inviteCode);
    if (!invite || !invite.isActive) throw new BadRequestException('รหัสเชิญไม่ถูกต้อง');
    if (invite.usedCount >= invite.maxUses) throw new BadRequestException('รหัสเชิญครบจำนวนแล้ว');

    const existing = await this.driverRepo.findOne({ where: { phone: dto.phoneNumber } });
    if (existing) throw new BadRequestException('เบอร์โทรนี้ลงทะเบียนแล้ว');

    const newDriver = this.driverRepo.create({
      id: `D-${Math.floor(Math.random() * 10000)}`,
      phone: dto.phoneNumber,
      name: dto.fullName,
      plate: dto.licensePlate,
      invite_code: dto.inviteCode,
      winId: invite.winId,
      approval_status: 'PENDING',
      profile_pic_url: dto.profilePicUrl // New: Save Profile Pic
    });

    await this.driverRepo.save(newDriver);
    invite.usedCount++;

    // Auto-approve for demo
    if (process.env.NODE_ENV !== 'production') {
      // await this.driverRepo.update(newDriver.id, { approval_status: 'APPROVED' });
    }

    return { success: true, message: 'ลงทะเบียนสำเร็จ รอการอนุมัติ', driverId: newDriver.id };
  }

  async goOnline(dto: DriverOnlineDto) {
    const { driverId, lat, lng } = dto;

    await this.redis.geoadd('drivers:locations', lng, lat, driverId);
    await this.driverRepo.update(driverId, { current_status: 'IDLE' });

    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    if (driver) {
      await this.redis.hmset(`driver:${driverId}:stats`, {
        status: 'IDLE',
        rating: driver.rating,
        tripsToday: driver.total_trips,
        lastTripTime: Date.now()
      });
    }

    const nearestWinId = this.findNearestStation(lat, lng);

    if (nearestWinId) {
      await this.fairQueueService.joinQueue(nearestWinId, driverId, lat, lng);
      return { status: 'QUEUED', winId: nearestWinId, message: `เข้าคิววิน: ${this.stations.get(nearestWinId)?.name}` };
    } else {
      return { status: 'ROAMING', message: 'อยู่นอกเขตวิน (Roaming)' };
    }
  }

  async getQueueStatus(driverId: string) {
    const winId = await this.redis.hget(`driver:${driverId}:stats`, 'currentWin');
    if (!winId) return { status: 'ROAMING' };

    const rank = await this.redis.zrevrank(`win:${winId}:queue`, driverId);
    const score = await this.redis.zscore(`win:${winId}:queue`, driverId);

    return { status: 'QUEUED', winId, position: rank !== null ? rank + 1 : null, score };
  }

  async acceptTrip(dto: TripActionDto) {
    const lockKey = `trip:${dto.tripId}:lock`;
    // Correct order: key, value, 'EX', seconds, 'NX'
    // Or key, value, 'NX', 'EX', seconds (depending on lib version, but usually options come after value)
    // ioredis often supports: redis.set(key, value, "EX", 10, "NX")
    const acquired = await this.redis.set(lockKey, dto.driverId, 'EX', 30, 'NX');

    if (!acquired) throw new BadRequestException('Trip expired or taken');

    const passengerId = await this.redis.hget(`trip:${dto.tripId}`, 'passengerId');
    const deductionSuccess = await this.creditService.deductForRide(passengerId, dto.tripId);

    if (!deductionSuccess) {
      await this.redis.del(lockKey);
      throw new BadRequestException('Passenger has insufficient funds.');
    }

    await this.redis.hset(`trip:${dto.tripId}`, 'status', 'ACCEPTED', 'driverId', dto.driverId);
    await this.redis.hset(`driver:${dto.driverId}:stats`, 'status', 'BUSY');

    await this.driverRepo.update(dto.driverId, { current_status: 'BUSY' });
    await this.tripRepo.update(dto.tripId, { driver_id: dto.driverId, status: 'ACCEPTED' });

    const winId = await this.redis.hget(`driver:${dto.driverId}:stats`, 'currentWin');
    if (winId) {
      await this.redis.zrem(`win:${winId}:queue`, dto.driverId);
      await this.redis.hdel(`driver:${dto.driverId}:stats`, 'currentWin');
    }

    return { success: true };
  }

  async rejectTrip(dto: TripActionDto) {
    const winId = await this.redis.hget(`driver:${dto.driverId}:stats`, 'currentWin');
    if (winId) {
      await this.fairQueueService.handleTimeout(winId, dto.driverId);
    }
    return { success: true, message: 'Trip rejected, queue position adjusted.' };
  }

  async completeTrip(dto: TripActionDto) {
    await this.redis.hset(`trip:${dto.tripId}`, 'status', 'COMPLETED');
    await this.redis.hset(`driver:${dto.driverId}:stats`, 'status', 'IDLE');

    await this.tripRepo.update(dto.tripId, { status: 'COMPLETED', completed_at: new Date() });
    await this.driverRepo.update(dto.driverId, { current_status: 'IDLE' });
    await this.driverRepo.increment({ id: dto.driverId }, 'total_trips', 1);

    return { success: true };
  }
}