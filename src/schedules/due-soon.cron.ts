import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

/**
 * Automatic reminders. Each query flags the rows it picks in the same
 * UPDATE (… RETURNING), so with several API instances, or a run that
 * overlaps the previous one, nobody gets reminded twice.
 */
@Injectable()
export class DueSoonCron {
  private readonly logger = new Logger(DueSoonCron.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async run() {
    for (const job of [this.chores, this.bills, this.events]) {
      try {
        await job.call(this);
      } catch (err) {
        this.logger.error(`Due-soon job failed: ${String(err)}`);
      }
    }
  }

  /** Open chores due within the next hour → their assignee */
  private async chores() {
    const [rows] = (await this.dataSource.query(
      `UPDATE chores SET "dueReminderSentAt" = now()
       WHERE status = 'todo'
         AND "assigneeId" IS NOT NULL
         AND "dueReminderSentAt" IS NULL
         AND "dueAt" BETWEEN now() AND now() + interval '1 hour'
       RETURNING id, title, "householdId", "assigneeId", "dueAt"`,
    )) as [Array<{ id: string; title: string; householdId: string; assigneeId: string; dueAt: Date }>, number];

    for (const chore of rows) {
      await this.notifications.notify([chore.assigneeId], {
        type: NotificationType.CHORE_DUE,
        title: `Due soon: ${chore.title}`,
        householdId: chore.householdId,
        data: { choreId: chore.id, dueAt: chore.dueAt },
      });
    }
  }

  /** Bills due tomorrow → members who still owe their share */
  private async bills() {
    const [rows] = (await this.dataSource.query(
      `UPDATE bills SET "dueReminderSentAt" = now()
       WHERE "dueReminderSentAt" IS NULL
         AND "dueDate" IS NOT NULL
         AND "dueDate" <= current_date + 1
         AND "dueDate" >= current_date
       RETURNING id, title, "householdId", "dueDate"`,
    )) as [Array<{ id: string; title: string; householdId: string; dueDate: string }>, number];
    if (!rows.length) return;

    const debtors: Array<{ billId: string; userId: string }> =
      await this.dataSource.query(
        `SELECT s."billId", s."userId"
         FROM bill_shares s JOIN bills b ON b.id = s."billId"
         WHERE s."billId" = ANY($1)
           AND s."settledAt" IS NULL
           AND s."userId" IS DISTINCT FROM b."paidById"`,
        [rows.map((b) => b.id)],
      );

    for (const bill of rows) {
      await this.notifications.notify(
        debtors.filter((d) => d.billId === bill.id).map((d) => d.userId),
        {
          type: NotificationType.BILL_DUE,
          title: `Bill due ${bill.dueDate}: ${bill.title}`,
          householdId: bill.householdId,
          data: { billId: bill.id },
        },
      );
    }
  }

  /** Events starting within 2 hours → members going or maybe */
  private async events() {
    const [rows] = (await this.dataSource.query(
      `UPDATE events SET "soonReminderSentAt" = now()
       WHERE "soonReminderSentAt" IS NULL
         AND "cancelledAt" IS NULL
         AND "startsAt" BETWEEN now() AND now() + interval '2 hours'
       RETURNING id, title, "householdId", "startsAt"`,
    )) as [Array<{ id: string; title: string; householdId: string; startsAt: Date }>, number];
    if (!rows.length) return;

    const attendees: Array<{ eventId: string; userId: string }> =
      await this.dataSource.query(
        `SELECT "eventId", "userId" FROM event_participants
         WHERE "eventId" = ANY($1) AND response IN ('going', 'maybe')`,
        [rows.map((e) => e.id)],
      );

    for (const event of rows) {
      await this.notifications.notify(
        attendees.filter((a) => a.eventId === event.id).map((a) => a.userId),
        {
          type: NotificationType.EVENT_SOON,
          title: `Starting soon: ${event.title}`,
          householdId: event.householdId,
          data: { eventId: event.id, startsAt: event.startsAt },
        },
      );
    }
  }
}
