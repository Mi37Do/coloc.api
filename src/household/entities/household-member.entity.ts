import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Household } from './household.entity.js';
import { User } from '../../users/entities/user.entity.js';

export enum MembershipStatus {
  /** Invited directly, waiting for the user to accept */
  PENDING = 'pending',
  ACTIVE = 'active',
  LEFT = 'left',
}

export enum HouseholdRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity('household_members')
@Unique(['householdId', 'userId'])
export class HouseholdMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  householdId: string;

  @ManyToOne(() => Household, (household) => household.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'householdId' })
  household: Relation<Household>;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'enum', enum: HouseholdRole, default: HouseholdRole.MEMBER })
  role: HouseholdRole;

  @Column({
    type: 'enum',
    enum: MembershipStatus,
    default: MembershipStatus.PENDING,
  })
  status: MembershipStatus;

  /** Who sent the direct invite, null when joined through a link */
  @Column({ type: 'uuid', nullable: true })
  invitedById?: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'invitedById' })
  invitedBy?: Relation<User> | null;

  @Column({ type: 'timestamptz', nullable: true })
  joinedAt?: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
