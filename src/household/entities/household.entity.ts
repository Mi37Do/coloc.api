import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  type Relation,
} from 'typeorm';
import { HouseholdMember } from './household-member.entity.js';
import { HouseholdInvite } from './household-invite.entity.js';

@Entity('households')
export class Household {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', nullable: true, length: 255 })
  address?: string;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  city?: string;

  @Column({ type: 'varchar', nullable: true, length: 100 })
  country?: string;

  @OneToMany(() => HouseholdMember, (member) => member.household)
  members: Relation<HouseholdMember[]>;

  @OneToMany(() => HouseholdInvite, (invite) => invite.household)
  invites: Relation<HouseholdInvite[]>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
