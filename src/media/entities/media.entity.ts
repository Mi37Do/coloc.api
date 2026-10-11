import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Household } from '../../household/entities/household.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Chore } from '../../chores/entities/chore.entity.js';
import { HouseholdEvent } from '../../events/entities/event.entity.js';
import { Conversation } from '../../chat/entities/conversation.entity.js';

/**
 * An uploaded image with exactly one owner: a chore, an event, a chat conversation
 * (photos sent in chat), or the household's shared GIF library.
 */
@Entity('media')
@Check(
  `(("choreId" IS NOT NULL)::int + ("eventId" IS NOT NULL)::int + ("conversationId" IS NOT NULL)::int + "libraryGif"::int) = 1`,
)
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  choreId: string | null;

  /** A photo sent in this chat; only its participants can open it */
  @Index()
  @Column({ type: 'uuid', nullable: true })
  conversationId: string | null;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'conversationId' })
  conversation: Relation<Conversation> | null;

  /** Part of the household's GIF library, which every member can send in chat */
  @Column({ type: 'boolean', default: false })
  libraryGif: boolean;

  @ManyToOne(() => Chore, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'choreId' })
  chore: Relation<Chore> | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  eventId: string | null;

  @ManyToOne(() => HouseholdEvent, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'eventId' })
  event: Relation<HouseholdEvent> | null;

  @Column({ type: 'uuid', nullable: true })
  uploadedById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: Relation<User> | null;

  /** Path inside the storage backend; never exposed to clients */
  @Column({ type: 'varchar', length: 255, select: false })
  storageKey: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 50 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @CreateDateColumn()
  createdAt: Date;
}
