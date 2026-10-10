import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsService } from './events.service.js';
import { EventsController } from './events.controller.js';
import { HouseholdEvent } from './entities/event.entity.js';
import { EventParticipant } from './entities/event-participant.entity.js';
import { EventExclusion } from './entities/event-exclusion.entity.js';
import { HouseholdModule } from '../household/household.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([HouseholdEvent, EventParticipant, EventExclusion]),
    HouseholdModule,
    MediaModule,
  ],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
