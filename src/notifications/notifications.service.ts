import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import {
  Notification,
  NotificationType,
} from './entities/notification.entity.js';
import { ListNotificationsDto } from './dto/list-notifications.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  householdId?: string | null;
  data?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Stores one notification per user and pushes it live as `notification` */
  async notify(userIds: string[], input: NotifyInput): Promise<void> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;

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
