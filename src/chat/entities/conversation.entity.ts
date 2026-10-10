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
import { ConversationMember } from './conversation-member.entity.js';

export enum ConversationType {
  /** One per household, every active member is in it */
  GROUP = 'group',
  /** Two members of the same household */
  DIRECT = 'direct',
}

@Entity('conversations')
@Index(['householdId', 'directKey'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  /**
   * 'group' for the group chat, or the two user ids sorted and joined for a
   * direct chat; the unique index makes "get or create" race-safe.
   */
  @Column({ type: 'varchar', length: 80 })
  directKey: string;

  /** Direct chats: both people. Group chat: rows appear as people read it. */
  @OneToMany(() => ConversationMember, (m) => m.conversation)
  members: Relation<ConversationMember[]>;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
