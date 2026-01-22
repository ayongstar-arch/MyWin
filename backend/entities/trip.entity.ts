import { Entity, Column, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('trips')
export class TripEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  @Index()
  passenger_id: string;

  @Column({ nullable: true })
  @Index()
  driver_id: string;

  @Column({ type: 'float' })
  pickup_lat: number;

  @Column({ type: 'float' })
  pickup_lng: number;

  @Column()
  pickup_address: string;

  @Column({ type: 'float' })
  dest_lat: number;

  @Column({ type: 'float' })
  dest_lng: number;

  @Column()
  dest_address: string;

  @Column({ default: 'SEARCHING' }) // SEARCHING, ACCEPTED, PICKED_UP, COMPLETED, CANCELLED
  status: string;

  @Column({ type: 'float', default: 0 })
  fare: number;

  @Column({ type: 'float', default: 0 })
  distance_km: number;

  @CreateDateColumn()
  requested_at: Date;

  @Column({ nullable: true })
  completed_at: Date;
}