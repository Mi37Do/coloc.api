import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

/** One phone that receives the user's pushes (FCM registration token) */
@Entity('device_tokens')
@Index(['userId'])
export class DeviceToken {
  @PrimaryColumn({ type: 'varchar', length: 512 })
  token: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
