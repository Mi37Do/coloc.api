import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Household } from '../../household/entities/household.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum ChoreStatus {
  TODO = 'todo',
  DONE = 'done',
}

export enum ChoreRecurrence {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

@Entity('chores')
@Index(['householdId', 'status', 'dueAt'])
export class Chore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: true })
  assigneeId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assigneeId' })
  assignee: Relation<User> | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueAt: Date | null;

  @Column({
    type: 'enum',
    enum: ChoreRecurrence,
    default: ChoreRecurrence.NONE,
  })
  recurrence: ChoreRecurrence;

  /** On completion of a recurring chore, hand the next one to the next member */
  @Column({ type: 'boolean', default: false })
  rotateAssignee: boolean;

  @Column({ type: 'enum', enum: ChoreStatus, default: ChoreStatus.TODO })
  status: ChoreStatus;

  /** Set by the "due soon" cron so the assignee is only reminded once */
  @Column({ type: 'timestamptz', nullable: true })
  dueReminderSentAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  completedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'completedById' })
  completedBy: Relation<User> | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
