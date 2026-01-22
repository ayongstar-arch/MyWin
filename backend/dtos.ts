import { IsString, IsNumber, IsNotEmpty, IsOptional, IsEnum, Min, Max, IsBoolean, IsDateString, IsArray } from 'class-validator';

export type AuthProvider = 'OTP' | 'LINE' | 'GOOGLE';

export class SocialLoginDto {
  @IsString()
  accessToken: string; // Or ID Token

  @IsEnum(['LINE', 'GOOGLE'])
  provider: AuthProvider;

  @IsString()
  @IsOptional()
  userType?: 'PASSENGER' | 'DRIVER';
}

// --- Driver DTOs ---

export class DriverLoginDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  pin: string; // Used as OTP in this flow
}

export class DriverRegisterDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  licensePlate: string;

  @IsString()
  @IsNotEmpty()
  inviteCode: string;

  @IsString()
  @IsOptional()
  profilePicUrl?: string; // New: Supports Profile Upload
}

export class DriverOnlineDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;
}

export class TripActionDto {
  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  @IsNotEmpty()
  tripId: string;
}

// --- Invite System DTOs ---

export type InviteType = 'STATION' | 'INDIVIDUAL' | 'TEMP';

export interface InviteCode {
  code: string;
  winId: string;
  type: InviteType;
  maxUses: number;
  usedCount: number;
  expiresAt: string; // ISO Date
  note?: string;
  createdBy: string;
  isActive: boolean;
}

export class CreateInviteCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  winId: string;

  @IsEnum(['STATION', 'INDIVIDUAL', 'TEMP'])
  type: InviteType;

  @IsNumber()
  @Min(1)
  maxUses: number;

  @IsDateString()
  expiresAt: string;

  @IsString()
  @IsOptional()
  note?: string;
}

// --- Passenger DTOs ---

export class PassengerRequestOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class PassengerVerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class PassengerRegisterDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  referralCode?: string; // Optional driver referral
}

export class RideRequestDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @IsNumber()
  pickupLat: number;

  @IsNumber()
  pickupLng: number;

  @IsString()
  @IsNotEmpty()
  pickupAddress: string;

  @IsNumber()
  destLat: number;

  @IsNumber()
  destLng: number;

  @IsString()
  @IsNotEmpty()
  destAddress: string;
}

// --- Credit System DTOs ---

export class TopupDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @IsNumber()
  @Min(20, { message: 'Minimum top-up is 20 THB' })
  amount: number; // Cash amount in THB

  @IsString()
  @IsOptional()
  paymentMethod?: string; // e.g. 'PROMPTPAY'
}

export class AdminRefundDto {
  @IsString()
  @IsNotEmpty()
  passengerId: string;

  @IsNumber()
  @Min(1)
  points: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

// --- Promotion Engine DTOs ---

export type PromoType = 'TOPUP_BONUS' | 'RIDE_DISCOUNT';

export interface PromotionRule {
  id: string;
  name: string;
  type: PromoType;
  description: string;

  // Conditions
  condition: {
    minTopupAmount?: number;
    maxPriorRides?: number;
    startTime?: string; // HH:mm
    endTime?: string;
    allowedAreaIds?: string[]; // New: Area Constraint
  };

  // Time-based Activation
  startDate?: string; // ISO Date
  endDate?: string;   // ISO Date

  // Anti-Abuse & Budgeting
  maxUsagePerUser?: number; // 0 = unlimited
  maxTotalUsage?: number;   // New: Global Budget Cap (e.g., first 1000 people)
  currentTotalUsage: number; // New: Tracking

  // Benefits
  benefit: {
    bonusPoints?: number;
    isFree?: boolean;
    discountAmount?: number;
  };

  active: boolean;
  stats: {
    usersCount: number;
    totalPointsGiven: number;
    estimatedRevenueGenerated: number; // For ROI simulation
  };
}

export class CreatePromotionDto {
  @IsString()
  name: string;

  @IsEnum(['TOPUP_BONUS', 'RIDE_DISCOUNT'])
  type: PromoType;

  @IsNumber()
  @IsOptional()
  minTopupAmount?: number;

  @IsNumber()
  @IsOptional()
  bonusPoints?: number;

  @IsBoolean()
  @IsOptional()
  isFreeRide?: boolean;

  @IsNumber()
  @IsOptional()
  maxUsagePerUser?: number;

  @IsNumber()
  @IsOptional()
  maxTotalUsage?: number;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string; // HH:mm

  @IsString()
  @IsOptional()
  endTime?: string; // HH:mm

  @IsArray()
  @IsOptional()
  allowedAreaIds?: string[];
}

// --- Admin DTOs ---

export class OverrideQueueDto {
  @IsString()
  @IsNotEmpty()
  winId: string;

  @IsString()
  @IsNotEmpty()
  driverId: string;

  @IsString()
  reason: string;
}

export class DateRangeDto {
  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class DailyCloseDto {
  @IsDateString()
  date: string;

  @IsString()
  confirmedBy: string;
}

export interface AreaPerformance {
  areaId: string;
  areaName: string;
  totalRides: number;
  revenue: number; // Based on 2 THB per ride (or actual rate)
  bonusCost: number; // Points given as bonuses used in this area
  grossMargin: number;
}
