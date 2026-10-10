import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Alert } from './alert.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('alert_acks')
export class AlertAck {
  @PrimaryColumn({ type: 'uuid' })
  alertId: string;

  @ManyToOne(() => Alert, (alert) => alert.acks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'alertId' })
  alert: Relation<Alert>;

  @PrimaryColumn({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @CreateDateColumn({ type: 'timestamptz' })
  ackAt: Date;
}
