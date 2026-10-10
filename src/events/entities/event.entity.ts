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
import { EventParticipant } from './event-participant.entity.js';
import { EventExclusion } from './event-exclusion.entity.js';

/** Named HouseholdEvent to avoid clashing with the global DOM `Event` type */
@Entity('events')
@Index(['householdId', 'startsAt'])
export class HouseholdEvent {
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

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  /** Set by the "starting soon" cron so participants are only reminded once */
  @Column({ type: 'timestamptz', nullable: true })
  soonReminderSentAt: Date | null;

  @OneToMany(() => EventParticipant, (p) => p.event)
  participants: Relation<EventParticipant[]>;

  @OneToMany(() => EventExclusion, (e) => e.event)
  exclusions: Relation<EventExclusion[]>;

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
