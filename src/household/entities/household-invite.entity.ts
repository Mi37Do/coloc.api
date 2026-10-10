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
import { Household } from './household.entity.js';
import { User } from '../../users/entities/user.entity.js';

/** Shareable join link: /join/:token */
@Entity('household_invites')
export class HouseholdInvite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token: string;

  /**
   * Short code to type in instead of opening the link, e.g. K7QM2X (shown as
   * K7Q-M2X). Stored without the dash. null on invites made before codes existed.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 6, nullable: true })
  code: string | null;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, (household) => household.invites, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  /** null = permanent link, 1 = single use */
  @Column({ type: 'int', nullable: true })
  maxUses: number | null;

  @Column({ type: 'int', default: 0 })
  usesCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User> | null;

  @CreateDateColumn()
  createdAt: Date;
}
