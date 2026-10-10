import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Household } from '../../household/entities/household.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { BillShare } from './bill-share.entity.js';

export enum BillCategory {
  RENT = 'rent',
  UTILITIES = 'utilities',
  INTERNET = 'internet',
  GROCERIES = 'groceries',
  HOUSEHOLD = 'household',
  OTHER = 'other',
}

@Entity('bills')
@Index(['householdId', 'createdAt'])
export class Bill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'enum', enum: BillCategory, default: BillCategory.OTHER })
  category: BillCategory;

  /** Integer cents, never floats, so splits always add up */
  @Column({ type: 'int' })
  amountCents: number;

  @Column({ type: 'char', length: 3, default: 'EUR' })
  currency: string;

  /** Member who paid the bill; the others owe them their share */
  @Column({ type: 'uuid', nullable: true })
  paidById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paidById' })
  paidBy: Relation<User> | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  /** Set by the "due soon" cron so debtors are only reminded once */
  @Column({ type: 'timestamptz', nullable: true })
  dueReminderSentAt: Date | null;

  @OneToMany(() => BillShare, (share) => share.bill, { cascade: ['insert'] })
  shares: Relation<BillShare[]>;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
