import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { RideRequestDto, PassengerRegisterDto } from './dtos';
import { CreditService } from './credit.service';
import { MapService } from './map.service';
import { SmsService } from './sms.service';
import { PassengerEntity } from './entities/passenger.entity';

@Injectable()
export class PassengerService implements OnModuleInit {
  private redis: Redis;
  private readonly logger = new Logger(PassengerService.name);

  constructor(
    @InjectRepository(PassengerEntity)
    private passengerRepo: Repository<PassengerEntity>,
    private creditService: CreditService,
    private mapService: MapService,
    private smsService: SmsService,
    private jwtService: JwtService
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  async onModuleInit() {
    // Seed Demo Passenger
    const demoUser = await this.passengerRepo.findOne({ where: { phone: '0899999999' } });
    if (!demoUser) {
      await this.passengerRepo.save({
        id: 'P-DEMO',
        phone: '0899999999',
        name: 'ผู้โดยสารทดสอบ',
        points_balance: 100,
        free_rides_remaining: 3
      });
      this.logger.log('Seeded Demo Passenger P-DEMO');
    }
  }

  // --- AUTHENTICATION ---

  async requestOtp(phoneNumber: string) {
    // 1. Generate 6-digit code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Store in Redis (Expire in 5 minutes)
    const key = `otp:passenger:${phoneNumber}`;
    await this.redis.set(key, otp, 'EX', 300);

    // 3. Send via SMS Service
    await this.smsService.sendOtp(phoneNumber, otp);

    this.logger.log(`OTP requested for passenger ${phoneNumber}`);
    return { success: true, message: 'OTP ถูกส่งไปยังเบอร์ของคุณแล้ว' };
  }

  async verifyOtp(phoneNumber: string, otp: string) {
    const key = `otp:passenger:${phoneNumber}`;
    const storedOtp = await this.redis.get(key);

    // Allow test OTP in development
    const isTestAccount = otp === '1234' && process.env.ALLOW_TEST_OTP === 'true';

    if (!isTestAccount && storedOtp !== otp) {
      throw new BadRequestException('รหัส OTP ไม่ถูกต้องหรือหมดอายุ');
    }

    // Delete OTP after successful verification
    if (!isTestAccount) await this.redis.del(key);

    return { success: true };
  }

  async login(phoneNumber: string, otp: string) {
    // 1. Verify OTP
    await this.verifyOtp(phoneNumber, otp);

    // 2. Check if user exists
    const passenger = await this.passengerRepo.findOne({ where: { phone: phoneNumber } });

    if (!passenger) {
      return { isRegistered: false };
    }

    // 3. Generate JWT
    const payload = { sub: passenger.id, role: 'PASSENGER', phone: passenger.phone };
    const token = this.jwtService.sign(payload);

    return {
      isRegistered: true,
      token: token,
      passengerId: passenger.id,
      name: passenger.name,
      pointsBalance: passenger.points_balance,
      freeRidesRemaining: passenger.free_rides_remaining
    };
  }

  async register(dto: PassengerRegisterDto) {
    // 1. Check if phone already exists
    const existing = await this.passengerRepo.findOne({ where: { phone: dto.phoneNumber } });
    if (existing) {
      throw new BadRequestException('เบอร์โทรนี้ลงทะเบียนแล้ว');
    }

    // 2. Create new passenger
    const newPassenger = this.passengerRepo.create({
      id: `P-${Math.floor(10000 + Math.random() * 90000)}`,
      phone: dto.phoneNumber,
      name: dto.name,
      points_balance: 0,
      free_rides_remaining: 3, // New user promo
      referral_code: dto.referralCode || null
    });

    await this.passengerRepo.save(newPassenger);

    // 3. Generate JWT immediately (Auto-login after register)
    const payload = { sub: newPassenger.id, role: 'PASSENGER', phone: newPassenger.phone };
    const token = this.jwtService.sign(payload);

    this.logger.log(`New passenger registered: ${newPassenger.id}`);

    return {
      success: true,
      message: 'ลงทะเบียนสำเร็จ',
      token: token,
      passengerId: newPassenger.id,
      name: newPassenger.name,
      freeRidesRemaining: newPassenger.free_rides_remaining
    };
  }

  async getProfile(passengerId: string) {
    const passenger = await this.passengerRepo.findOne({ where: { id: passengerId } });
    if (!passenger) {
      throw new BadRequestException('ไม่พบข้อมูลผู้โดยสาร');
    }
    return {
      id: passenger.id,
      name: passenger.name,
      phone: passenger.phone,
      pointsBalance: passenger.points_balance,
      totalRides: passenger.total_rides,
      freeRidesRemaining: passenger.free_rides_remaining
    };
  }

  // --- RIDE OPERATIONS ---

  async requestRide(dto: RideRequestDto) {
    // --- STEP 1: CALCULATE REAL DISTANCE & PRICE ---
    const route = await this.mapService.getRoutingInfo(
      dto.pickupLat, dto.pickupLng,
      dto.destLat, dto.destLng
    );

    // Example Pricing Logic: 20 THB base + 5 THB/km
    const estimatedFare = 20 + (route.distanceKm * 5);
    // Convert to "Credits" (Assuming 1 Credit = 1 THB for simplicity in this model)
    const pointsRequired = Math.ceil(estimatedFare);

    // --- STEP 2: CHECK BALANCE ---
    const canAfford = await this.creditService.checkAvailability(dto.passengerId);

    if (!canAfford) {
      throw new BadRequestException('แต้มไม่เพียงพอ กรุณาเติมเงิน');
    }

    // --- STEP 3: CREATE TRIP ---
    const tripId = crypto.randomUUID();
    const tripData = {
      id: tripId,
      ...dto,
      status: 'SEARCHING',
      requestedAt: Date.now(),
      passengerId: dto.passengerId,
      distanceKm: route.distanceKm,
      fare: pointsRequired
    };

    await this.redis.hset(`trip:${tripId}`, tripData);

    // --- STEP 4: DISPATCH ---
    await this.redis.publish('ride:requested', JSON.stringify(tripId));

    // --- STEP 5: TIMEOUT HANDLING ---
    this.setupTimeout(tripId);

    return {
      tripId,
      status: 'SEARCHING',
      fare: pointsRequired,
      distance: route.distanceKm.toFixed(1) + ' km',
      eta: route.durationMins + ' mins'
    };
  }

  async getRideStatus(tripId: string) {
    const status = await this.redis.hget(`trip:${tripId}`, 'status');
    const driverId = await this.redis.hget(`trip:${tripId}`, 'driverId');
    return { tripId, status, driverId };
  }

  private setupTimeout(tripId: string) {
    const TIMEOUT_MS = 60000;

    setTimeout(async () => {
      const currentStatus = await this.redis.hget(`trip:${tripId}`, 'status');

      if (currentStatus === 'SEARCHING') {
        await this.redis.hset(`trip:${tripId}`, 'status', 'TIMEOUT_NO_DRIVER');
        console.log(`Trip ${tripId} timed out.`);
      }
    }, TIMEOUT_MS);
  }
}