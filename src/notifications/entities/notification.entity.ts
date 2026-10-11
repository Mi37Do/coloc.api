import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Household } from '../../household/entities/household.entity.js';

export enum NotificationType {
  HOUSEHOLD_INVITE = 'household_invite',
  MEMBER_JOINED = 'member_joined',
  CHORE_ASSIGNED = 'chore_assigned',
  CHORE_DUE = 'chore_due',
  CHORE_UPDATED = 'chore_updated',
  CHORE_DONE = 'chore_done',
  BILL_CREATED = 'bill_created',
  BILL_DUE = 'bill_due',
  BILL_UPDATED = 'bill_updated',
  EVENT_CREATED = 'event_created',
  EVENT_CANCELLED = 'event_cancelled',
  EVENT_SOON = 'event_soon',
  EVENT_UPDATED = 'event_updated',
  SHOPPING_UPDATED = 'shopping_updated',
  MESSAGE = 'message',
  ALERT = 'alert',
  REMINDER = 'reminder',
}

@Entity('notifications')
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'uuid', nullable: true })
  householdId: string | null;

  @ManyToOne(() => Household, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household> | null;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  /** Ids the app needs to open the right screen, e.g. { choreId } */
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
