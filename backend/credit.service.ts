import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';
import { TopupDto, AdminRefundDto } from './dtos';
import { PromotionService } from './promotion.service';

// Schema Table Names
const TABLE_PASSENGERS = 'passengers';
const TABLE_WALLET = 'wallet';
const TABLE_WALLET_TXN = 'wallet_transactions';
const TABLE_PAYMENT_TXN = 'payment_transactions';
const TABLE_CONFIG = 'admin_rate_config';

@Injectable()
export class CreditService {
  private readonly redis: Redis;
  private readonly logger = new Logger(CreditService.name);

  constructor(
    private dataSource: DataSource,
    private promotionService: PromotionService
  ) {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }

  private async acquireLock(passengerId: string): Promise<boolean> {
    const key = `lock:passenger:${passengerId}:credit`;
    const result = await this.redis.set(key, 'LOCKED', 'EX', 5, 'NX');
    return result === 'OK';
  }

  private async releaseLock(passengerId: string): Promise<void> {
    await this.redis.del(`lock:passenger:${passengerId}:credit`);
  }

  async getEffectiveRate(): Promise<number> {
    const cacheKey = 'config:credit_rate';
    const cached = await this.redis.get(cacheKey);
    if (cached) return parseFloat(cached);

    const config = await this.dataSource.query(
      `SELECT credit_per_call FROM ${TABLE_CONFIG} WHERE active = true ORDER BY effective_time DESC LIMIT 1`
    );

    const rate = config[0]?.credit_per_call || 2.0;
    await this.redis.set(cacheKey, rate, 'EX', 60);
    return rate;
  }

  async getBalance(passengerId: string): Promise<number> {
    const res = await this.dataSource.query(
      `SELECT w.point_balance 
       FROM ${TABLE_WALLET} w 
       WHERE w.passenger_id = $1`,
      [passengerId]
    );
    return res.length ? parseFloat(res[0].point_balance) : 0;
  }

  /**
   * Helper: Get Total Completed Rides (for promotion check)
   */
  async getRideCount(passengerId: string): Promise<number> {
    // In a real app, this would be a COUNT(*) query on trip history or wallet deductions
    // Simulating query:
    const res = await this.dataSource.query(
      `SELECT COUNT(*) as count FROM ${TABLE_WALLET_TXN} WHERE passenger_id = $1 AND type = 'DEDUCT'`,
      [passengerId]
    );
    return res[0]?.count ? parseInt(res[0].count) : 0;
  }

  /**
   * Check if passenger has enough points without deducting.
   */
  async checkAvailability(passengerId: string): Promise<boolean> {
    // Check basic rate
    const baseCost = await this.getEffectiveRate();

    // Check for Free Ride Promo?
    // Note: Usually we verify basic solvency even if ride is free to prevent abuse, 
    // but for "First Ride Free", we should allow 0 balance.

    const rideCount = await this.getRideCount(passengerId);
    const currentHour = new Date().getHours();
    const promo = this.promotionService.evaluateRide(passengerId, rideCount, currentHour);

    if (promo.isFree) return true;

    const balance = await this.getBalance(passengerId);
    const effectiveCost = Math.max(0, baseCost - promo.discount);

    return balance >= effectiveCost;
  }

  /**
   * TOP-UP with PROMOTION ENGINE
   */
  async topup(dto: TopupDto) {
    const locked = await this.acquireLock(dto.passengerId);
    if (!locked) throw new BadRequestException('Transaction in progress.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Payment Record
      const paymentRes = await queryRunner.query(
        `INSERT INTO ${TABLE_PAYMENT_TXN} 
         (passenger_id, amount_baht, payment_method, status, created_at)
         VALUES ($1, $2, 'PROMPTPAY', 'PAID', NOW()) RETURNING payment_id`,
        [dto.passengerId, dto.amount]
      );
      const paymentId = paymentRes[0].payment_id;

      // 2. Promotion Engine Check
      const { rule, bonus } = this.promotionService.evaluateTopup(dto.passengerId, dto.amount);
      const totalPoints = dto.amount + bonus;

      // 3. Update Wallet
      await queryRunner.query(
        `INSERT INTO ${TABLE_WALLET} (passenger_id, point_balance, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (passenger_id) 
         DO UPDATE SET point_balance = ${TABLE_WALLET}.point_balance + $2, updated_at = NOW()`,
        [dto.passengerId, totalPoints]
      );

      // 4. Log Transaction (Include Promo Info in ref or separate column)
      await queryRunner.query(
        `INSERT INTO ${TABLE_WALLET_TXN} 
         (passenger_id, type, point_change, amount_baht, reference_id, status, created_at)
         VALUES ($1, 'TOPUP', $2, $3, $4, 'SUCCESS', NOW())`,
        [dto.passengerId, totalPoints, dto.amount, paymentId]
      );

      // 5. Update Promo Stats
      if (rule) {
        this.promotionService.logUsage(rule.id, bonus);
        this.logger.log(`Applied Promo ${rule.name} for User ${dto.passengerId}: +${bonus} points`);
      }

      await queryRunner.commitTransaction();
      return { success: true, pointsAdded: totalPoints, bonus, paymentId };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
      await this.releaseLock(dto.passengerId);
    }
  }

  /**
   * DEDUCT with PROMOTION ENGINE
   */
  async deductForRide(passengerId: string, tripId: string): Promise<boolean> {
    const locked = await this.acquireLock(passengerId);
    if (!locked) throw new BadRequestException('System busy.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Get Base Cost
      const baseCost = await this.getEffectiveRate();

      // 2. Check Promotions
      const rideCount = await this.getRideCount(passengerId);
      const currentHour = new Date().getHours();
      const { rule, discount, isFree } = this.promotionService.evaluateRide(passengerId, rideCount, currentHour);

      const effectiveCost = isFree ? 0 : Math.max(0, baseCost - discount);

      // 3. Check Balance (skip if free)
      if (!isFree) {
        const wallet = await queryRunner.query(
          `SELECT point_balance FROM ${TABLE_WALLET} WHERE passenger_id = $1 FOR UPDATE`,
          [passengerId]
        );
        if (!wallet.length || parseFloat(wallet[0].point_balance) < effectiveCost) {
          throw new BadRequestException('Insufficient points.');
        }
      }

      // 4. Deduct
      if (effectiveCost > 0) {
        await queryRunner.query(
          `UPDATE ${TABLE_WALLET} SET point_balance = point_balance - $1, updated_at = NOW() WHERE passenger_id = $2`,
          [effectiveCost, passengerId]
        );
      }

      // 5. Log Deduction
      await queryRunner.query(
        `INSERT INTO ${TABLE_WALLET_TXN} 
         (passenger_id, type, point_change, amount_baht, reference_id, status, created_at)
         VALUES ($1, 'DEDUCT', $2, 0, $3, 'SUCCESS', NOW())`,
        [passengerId, -effectiveCost, tripId]
      );

      // 6. Update Promo Stats
      if (rule) {
        const benefitValue = isFree ? baseCost : discount;
        this.promotionService.logUsage(rule.id, benefitValue);
        this.logger.log(`Applied Ride Promo ${rule.name} for User ${passengerId}: Saved ${benefitValue} points`);
      }

      await queryRunner.commitTransaction();
      return true;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.warn(`Deduction failed for Trip ${tripId}: ${err.message}`);
      return false;
    } finally {
      await queryRunner.release();
      await this.releaseLock(passengerId);
    }
  }

  // ... refund method remains same ...
  async refund(dto: AdminRefundDto) {
    const locked = await this.acquireLock(dto.passengerId);
    if (!locked) throw new BadRequestException('System busy.');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `UPDATE ${TABLE_WALLET} SET point_balance = point_balance + $1, updated_at = NOW() WHERE passenger_id = $2`,
        [dto.points, dto.passengerId]
      );

      await queryRunner.query(
        `INSERT INTO ${TABLE_WALLET_TXN} 
         (passenger_id, type, point_change, amount_baht, reference_id, status, created_at)
         VALUES ($1, 'REFUND', $2, 0, $3, 'SUCCESS', NOW())`,
        [dto.passengerId, dto.points, dto.reason]
      );

      await queryRunner.commitTransaction();
      return { success: true, refunded: dto.points };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
      await this.releaseLock(dto.passengerId);
    }
  }
}