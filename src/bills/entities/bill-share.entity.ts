import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Bill } from './bill.entity.js';
import { User } from '../../users/entities/user.entity.js';

/** One member's part of a bill */
@Entity('bill_shares')
@Unique(['billId', 'userId'])
export class BillShare {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  billId: string;

  @ManyToOne(() => Bill, (bill) => bill.shares, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billId' })
  bill: Relation<Bill>;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'int' })
  amountCents: number;

  /** Set once this member has paid back the payer (payer's own share is settled at creation) */
  @Column({ type: 'timestamptz', nullable: true })
  settledAt: Date | null;
}
