import { Logger } from '@nestjs/common';
import { OnQueueFailed, Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { SchedulesService } from './schedules.service.js';
import {
  FIRE_REMINDER_JOB,
  REMINDERS_QUEUE,
  type FireReminderJob,
} from './schedules.constants.js';

@Processor(REMINDERS_QUEUE)
export class RemindersProcessor {
  private readonly logger = new Logger(RemindersProcessor.name);

  constructor(private readonly schedulesService: SchedulesService) {}

  @Process(FIRE_REMINDER_JOB)
  async fire(job: Job<FireReminderJob>) {
    await this.schedulesService.fire(job.data.reminderId);
  }

  @OnQueueFailed()
  onFailed(job: Job<FireReminderJob>, err: Error) {
    this.logger.error(
      `Reminder ${job.data.reminderId} failed (attempt ${job.attemptsMade}): ${err.message}`,
    );
  }
}
