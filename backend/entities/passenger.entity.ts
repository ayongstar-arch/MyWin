import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('passengers')
export class PassengerEntity {
  @PrimaryColumn()
  id: string; // Using format P-XXXX

  @Column({ unique: true })
  phone: string;

  @Column()
  name: string;

  @Column({ type: 'int', default: 0 })
  points_balance: number;

  @Column({ type: 'int', default: 0 })
  total_rides: number;

  @Column({ type: 'int', default: 3 })
  free_rides_remaining: number; // New user promo

  @Column({ nullable: true })
  profile_pic_url: string;

  @Column({ nullable: true })
  referral_code: string; // Driver referral

  @Column({ nullable: true })
  auth_provider: string; // 'OTP' | 'LINE' | 'GOOGLE'

  @Column({ nullable: true })
  pin_hash: string; // Permanent PIN for login

  @Column({ nullable: true })
  provider_id: string; // LINE userId or Google sub

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  avatar_url: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
