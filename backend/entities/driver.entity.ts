import { Entity, Column, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('drivers')
export class DriverEntity {
  @PrimaryColumn()
  id: string; // Using format D-XXXX

  @Column({ unique: true })
  phone: string;

  @Column()
  name: string;

  @Column()
  plate: string;

  @Column()
  invite_code: string;

  @Column({ name: 'win_id' })
  @Index()
  winId: string;

  @Column({ default: 'PENDING' }) // PENDING, APPROVED, SUSPENDED
  approval_status: string;

  @Column({ default: 'OFFLINE' }) // OFFLINE, IDLE, BUSY
  current_status: string;

  @Column({ type: 'float', default: 5.0 })
  rating: number;

  @Column({ default: 0 })
  total_trips: number;

  @Column({ nullable: true })
  profile_pic_url: string;

  @Column({ nullable: true })
  auth_provider: string; // 'OTP' | 'LINE' | 'GOOGLE'

  @Column({ nullable: true })
  pin_hash: string; // Permanent PIN

  @Column({ nullable: true })
  provider_id: string;

  @Column({ nullable: true })
  email: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}