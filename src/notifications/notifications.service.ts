import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { PushService } from './push.service.js';
import { User } from '../users/entities/user.entity.js';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  householdId?: string | null;
  data?: Record<string, unknown>;
  /** false: push to phones only, nothing in the bell (chat messages) */
  store?: boolean;
  /** Pushes with the same tag replace each other on the phone */
  tag?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushService,
  ) {}

  /** First name for titles like "Sara added a bill" */
  async nameOf(userId: string): Promise<string> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, firstname: true, username: true },
    });
    return user?.firstname || user?.username || 'Someone';
  }

  /**
   * Stores one notification per user, pushes it live as `notification`
   * and sends it to their phones
   */
  async notify(userIds: string[], input: NotifyInput): Promise<void> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;

    const pushData = {
      ...input.data,
      type: input.type,
      householdId: input.householdId ?? undefined,
    };
    if (input.store === false) {
      await this.push.send(unique, {
        title: input.title,
        body: input.body,
        data: pushData,
        tag: input.tag,
      });
      return;
    }

    const rows = await this.notifications.save(
      unique.map((userId) =>
        this.notifications.create({
          userId,
          type: input.type,
          title: input.title.slice(0, 200),
          body: input.body ?? null,
          householdId: input.householdId ?? null,
          data: input.data ?? {},
        }),
      ),
    );
    for (const row of rows) {
      this.realtime.emitToUsers([row.userId], 'notification', row);
    }
    await this.push.send(unique, {
      title: input.title,
      body: input.body,
      data: { ...pushData, notificationId: rows.length === 1 ? rows[0].id : undefined },
      tag: input.tag,
    });
  }

  /** Every active member of the household, minus `except` */
  async notifyHousehold(
    householdId: string,
    input: NotifyInput,
    except: string[] = [],
  ): Promise<void> {
    const ids = await this.realtime.activeMemberIds(householdId);
    await this.notify(
      ids.filter((id) => !except.includes(id)),
      { ...input, householdId },
    );
  }

  list(userId: string, { unreadOnly, before, limit = 30 }: ListNotificationsDto) {
    return this.notifications.find({
      where: {
        userId,
        ...(unreadOnly && { readAt: IsNull() }),
        ...(before && { createdAt: LessThan(new Date(before)) }),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.notifications.count({
      where: { userId, readAt: IsNull() },
    });
    return { count };
  }

  async markRead(userId: string, id: string) {
    const result = await this.notifications.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    if (!result.affected) {
      const exists = await this.notifications.exists({ where: { id, userId } });
      if (!exists) throw new NotFoundException('Notification not found');
    }
  }

  async markAllRead(userId: string) {
    await this.notifications.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async remove(userId: string, id: string) {
    await this.notifications.delete({ id, userId });
  }
}
