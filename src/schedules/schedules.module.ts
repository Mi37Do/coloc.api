import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulesService } from './schedules.service.js';
import { SchedulesController } from './schedules.controller.js';
import { RemindersProcessor } from './reminders.processor.js';
import { DueSoonCron } from './due-soon.cron.js';
import { Reminder } from './entities/reminder.entity.js';
import { REMINDERS_QUEUE } from './schedules.constants.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Reminder]),
    // Redis connection + cron scheduler. They live here because this is
    // the only module using them; move to AppModule if that changes.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    BullModule.registerQueue({ name: REMINDERS_QUEUE }),
    ScheduleModule.forRoot(),
    HouseholdModule,
  ],
  controllers: [SchedulesController],
  providers: [SchedulesService, RemindersProcessor, DueSoonCron],
})
export class SchedulesModule {}
