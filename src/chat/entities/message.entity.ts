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
import { Conversation } from './conversation.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Media } from '../../media/entities/media.entity.js';

@Entity('messages')
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Relation<Conversation>;

  @Column({ type: 'uuid', nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'senderId' })
  sender: Relation<User> | null;

  /** Emptied when the message is deleted; the row stays as a placeholder */
  @Column({ type: 'text' })
  body: string;

  /** A photo sent in this chat (media owned by the conversation) */
  @Column({ type: 'uuid', nullable: true })
  imageId: string | null;

  @ManyToOne(() => Media, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'imageId' })
  image: Relation<Media> | null;

  /** A GIF from the household library; cleared when the GIF is removed from it */
  @Column({ type: 'uuid', nullable: true })
  gifId: string | null;

  @ManyToOne(() => Media, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'gifId' })
  gif: Relation<Media> | null;

  @Column({ type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
