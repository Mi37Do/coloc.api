import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { HouseholdEvent } from './event.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum RsvpResponse {
  GOING = 'going',
  MAYBE = 'maybe',
  DECLINED = 'declined',
}

/** A member's answer to an event; members who haven't answered have no row */
@Entity('event_participants')
@Unique(['eventId', 'userId'])
export class EventParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => HouseholdEvent, (event) => event.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: Relation<HouseholdEvent>;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'enum', enum: RsvpResponse })
  response: RsvpResponse;

  @UpdateDateColumn()
  respondedAt: Date;
}
