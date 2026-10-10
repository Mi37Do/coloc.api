import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { InjectRepository } from '@nestjs/typeorm';
import type { Queue } from 'bull';
import { Brackets, IsNull, Repository } from 'typeorm';
import { Reminder } from './entities/reminder.entity.js';
import { CreateReminderDto, ListRemindersDto } from './dto/reminder.dto.js';
import {
  FIRE_REMINDER_JOB,
  REMINDERS_QUEUE,
  type FireReminderJob,
} from './schedules.constants.js';
import { HouseholdService } from '../household/household.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import {
  HouseholdMember,
  HouseholdRole,
} from '../household/entities/household-member.entity.js';

const MAX_AHEAD_MS = 366 * 24 * 3600 * 1000;

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(Reminder)
    private readonly reminders: Repository<Reminder>,
    @InjectQueue(REMINDERS_QUEUE)
    private readonly queue: Queue<FireReminderJob>,
    private readonly householdService: HouseholdService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(householdId: string, userId: string, dto: CreateReminderDto) {
    const remindAt = new Date(dto.remindAt);
    const delay = remindAt.getTime() - Date.now();
    if (delay <= 0) throw new BadRequestException('remindAt must be in the future');
    if (delay > MAX_AHEAD_MS) {
      throw new BadRequestException('remindAt must be within a year');
    }
    if (dto.forUserId) {
      await this.householdService.assertActiveMembers(householdId, [dto.forUserId]);
    }

    const reminder = await this.reminders.save(
      this.reminders.create({ ...dto, remindAt, householdId, createdById: userId }),
    );
    // jobId = reminder id, so cancelling can find and remove the job
    await this.queue.add(
      FIRE_REMINDER_JOB,
      { reminderId: reminder.id },
      {
        jobId: reminder.id,
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
      },
    );
    return reminder;
  }

  /** Household-wide reminders + your personal ones; others' personal ones stay private */
  findAll(householdId: string, userId: string, { all }: ListRemindersDto) {
    const qb = this.reminders
      .createQueryBuilder('r')
      .where('r.householdId = :householdId', { householdId })
      .andWhere(
        new Brackets((w) =>
          w
            .where('r.forUserId IS NULL')
            .orWhere('r.forUserId = :userId')
            .orWhere('r.createdById = :userId'),
        ),
        { userId },
      )
      .orderBy('r.remindAt', 'ASC');
    if (!all) {
      qb.andWhere('r.sentAt IS NULL AND r.cancelledAt IS NULL').andWhere(
        'r.remindAt > now()',
      );
    }
    return qb.getMany();
  }

  /** Creator or admin */
  async cancel(householdId: string, id: string, me: HouseholdMember) {
    const reminder = await this.reminders.findOne({
      where: { id, householdId, sentAt: IsNull(), cancelledAt: IsNull() },
    });
    const visible =
      reminder &&
      (reminder.forUserId === null ||
        reminder.forUserId === me.userId ||
        reminder.createdById === me.userId);
    if (!reminder || !visible) throw new NotFoundException('Reminder not found');
    if (me.role !== HouseholdRole.ADMIN && reminder.createdById !== me.userId) {
      throw new ForbiddenException('Only the creator or an admin can cancel this');
    }

    await this.reminders.update(reminder.id, { cancelledAt: new Date() });
    const job = await this.queue.getJob(reminder.id);
    await job?.remove().catch(() => undefined); // may be running right now
  }

  /** Called by the queue processor when the delay expires */
  async fire(reminderId: string) {
    // Claim it atomically so a retried job can't send twice
    const claimed = await this.reminders
      .createQueryBuilder()
      .update()
      .set({ sentAt: () => 'now()' })
      .where({ id: reminderId, sentAt: IsNull(), cancelledAt: IsNull() })
      .returning('*')
      .execute();
    const reminder = (claimed.raw as Reminder[])[0];
    if (!reminder) return;

    const input = {
      type: NotificationType.REMINDER,
      title: `⏰ ${reminder.title}`,
      body: reminder.note,
      householdId: reminder.householdId,
      data: { reminderId: reminder.id },
    };
    if (reminder.forUserId) {
      await this.notifications.notify([reminder.forUserId], input);
    } else {
      await this.notifications.notifyHousehold(reminder.householdId, input);
    }
  }
}
