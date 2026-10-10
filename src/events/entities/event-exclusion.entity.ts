import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { HouseholdEvent } from './event.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * A member hidden from an event (e.g. a surprise party): they can't see
 * the event, RSVP to it, or view its photos.
 */
@Entity('event_exclusions')
export class EventExclusion {
  @PrimaryColumn({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => HouseholdEvent, (event) => event.exclusions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'eventId' })
  event: Relation<HouseholdEvent>;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;
}
