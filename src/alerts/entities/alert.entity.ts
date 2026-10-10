import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Household } from '../../household/entities/household.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { AlertAck } from './alert-ack.entity.js';

export enum AlertType {
  FIRE = 'fire',
  MEDICAL = 'medical',
  INTRUSION = 'intrusion',
  WATER_LEAK = 'water_leak',
  GAS = 'gas',
  POWER = 'power',
  OTHER = 'other',
}

@Entity('alerts')
@Index(['householdId', 'createdAt'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Column({ type: 'enum', enum: AlertType })
  type: AlertType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  message: string | null;

  /** e.g. "kitchen", "2nd floor bathroom" */
  @Column({ type: 'varchar', length: 120, nullable: true })
  location: string | null;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: Relation<User> | null;

  /** Members who confirmed they saw it */
  @OneToMany(() => AlertAck, (ack) => ack.alert)
  acks: Relation<AlertAck[]>;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedById: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
