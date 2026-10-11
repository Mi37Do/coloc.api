import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, type: 'varchar', length: 30 })
  username: string;

  @Column({ type: 'varchar', length: 50 })
  firstname: string;

  @Column({ type: 'varchar', length: 50 })
  lastname: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  @Column({ unique: true, type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', select: false })
  passwordHash: string;

  /**
   * Defaults to true so accounts created before email confirmation existed
   * stay usable; UsersService.create sets false for every new sign-up.
   */
  @Column({ type: 'boolean', default: true })
  emailVerified: boolean;

  /** sha256 of the pending 6-digit code */
  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  verificationCodeHash: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  verificationCodeExpiresAt: Date | null;

  /** When the last code was sent, to rate-limit resends */
  @Column({ type: 'timestamptz', nullable: true, select: false })
  verificationCodeSentAt: Date | null;

  /** Wrong guesses against the current code */
  @Column({ type: 'int', default: 0, select: false })
  verificationAttempts: number;

  /** Profile picture in storage; never exposed to clients */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  avatarKey: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, select: false })
  avatarMime: string | null;

  /** Set when the user has a profile picture; clients use it to cache-bust /users/:id/avatar */
  @Column({ type: 'timestamptz', nullable: true })
  avatarUpdatedAt: Date | null;

  @Column({ type: 'int' })
  countryId: number;

  @Column({ type: 'date' })
  birthDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
