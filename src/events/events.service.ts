import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { ListEventsDto } from './dto/event-query.dto.js';
import { HouseholdEvent } from './entities/event.entity.js';
import {
  EventParticipant,
  RsvpResponse,
} from './entities/event-participant.entity.js';
import { EventExclusion } from './entities/event-exclusion.entity.js';
import { HouseholdService } from '../household/household.service.js';
import { MediaService } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

/**
 * Every read takes the viewer's id: members excluded from an event get a
 * 404, exactly as if it didn't exist.
 */
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(HouseholdEvent)
    private readonly events: Repository<HouseholdEvent>,
    @InjectRepository(EventParticipant)
    private readonly participants: Repository<EventParticipant>,
    private readonly householdService: HouseholdService,
    private readonly mediaService: MediaService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  /** The proposer is marked as going */
  async create(householdId: string, userId: string, dto: CreateEventDto) {
    const { excludedUserIds = [], ...fields } = dto;
    assertValidRange(fields.startsAt, fields.endsAt);
    await this.assertExclusionsValid(householdId, userId, excludedUserIds);

    const event = await this.dataSource.transaction(async (em) => {
      const event = await em.save(
        em.create(HouseholdEvent, { ...fields, householdId, createdById: userId }),
      );
      await em.save(
        em.create(EventParticipant, {
          eventId: event.id,
          userId,
          response: RsvpResponse.GOING,
        }),
      );
      await this.replaceExclusions(em, event.id, excludedUserIds);
      return event;
    });

    await this.notifications.notifyHousehold(
      householdId,
      {
        type: NotificationType.EVENT_CREATED,
        title: `New event: ${event.title}`,
        data: { eventId: event.id, startsAt: event.startsAt },
      },
      [userId, ...excludedUserIds],
    );
    return this.findOne(householdId, event.id, userId);
  }

  findAll(householdId: string, viewerId: string, { from, to }: ListEventsDto) {
    const qb = this.events
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.participants', 'participant')
      .where('event.householdId = :householdId', { householdId })
      .andWhere(visibleTo('event', ':viewerId'), { viewerId })
      .andWhere('COALESCE(event.endsAt, event.startsAt) >= :from', {
        from: from ?? new Date().toISOString(),
      })
      .orderBy('event.startsAt', 'ASC');
    if (to) qb.andWhere('event.startsAt <= :to', { to });
    return qb.getMany();
  }

  async findOne(householdId: string, id: string, viewerId: string) {
    const event = await this.events
      .createQueryBuilder('event')
      .leftJoin('event.createdBy', 'createdBy')
      .addSelect(['createdBy.id', 'createdBy.username', 'createdBy.firstname', 'createdBy.lastname'])
      .leftJoin('event.participants', 'participant')
      .addSelect(['participant.id', 'participant.userId', 'participant.response', 'participant.respondedAt'])
      .leftJoin('participant.user', 'participantUser')
      .addSelect(['participantUser.id', 'participantUser.username', 'participantUser.firstname', 'participantUser.lastname'])
      .leftJoinAndSelect('event.exclusions', 'exclusion')
      .where('event.id = :id AND event.householdId = :householdId', { id, householdId })
      .andWhere(visibleTo('event', ':viewerId'), { viewerId })
      .getOne();
    if (!event) throw new NotFoundException('Event not found');

    const { exclusions, ...rest } = event;
    return { ...rest, excludedUserIds: exclusions.map((e) => e.userId) };
  }

  async update(
    householdId: string,
    id: string,
    viewerId: string,
    dto: UpdateEventDto,
  ) {
    const event = await this.findOne(householdId, id, viewerId);
    const { excludedUserIds, ...fields } = dto;
    assertValidRange(
      fields.startsAt ?? event.startsAt.toISOString(),
      fields.endsAt ?? event.endsAt?.toISOString(),
    );
    if (excludedUserIds) {
      await this.assertExclusionsValid(
        householdId,
        event.createdById,
        excludedUserIds,
      );
    }

    await this.dataSource.transaction(async (em) => {
      if (Object.keys(fields).length) {
        await em.update(HouseholdEvent, event.id, {
          ...fields,
          ...(fields.startsAt && { soonReminderSentAt: null }),
        });
      }
      if (excludedUserIds) {
        await this.replaceExclusions(em, event.id, excludedUserIds);
      }
    });
    return this.findOne(householdId, id, viewerId);
  }

  async setCancelled(
    householdId: string,
    id: string,
    viewerId: string,
    cancelled: boolean,
  ) {
    const event = await this.findOne(householdId, id, viewerId);
    await this.events.update(event.id, {
      cancelledAt: cancelled ? new Date() : null,
    });

    if (cancelled && !event.cancelledAt) {
      await this.notifications.notifyHousehold(
        householdId,
        {
          type: NotificationType.EVENT_CANCELLED,
          title: `Cancelled: ${event.title}`,
          data: { eventId: event.id },
        },
        [viewerId, ...event.excludedUserIds],
      );
    }
    return this.findOne(householdId, id, viewerId);
  }

  async remove(householdId: string, id: string, viewerId: string) {
    const event = await this.findOne(householdId, id, viewerId);
    await this.mediaService.removeAllFor({ eventId: event.id });
    await this.events.delete(event.id);
  }

  async rsvp(
    householdId: string,
    id: string,
    userId: string,
    response: RsvpResponse,
  ) {
    const event = await this.findOne(householdId, id, userId);
    if (event.cancelledAt) {
      throw new BadRequestException('This event was cancelled');
    }
    await this.participants.upsert(
      { eventId: event.id, userId, response },
      ['eventId', 'userId'],
    );
    return this.findOne(householdId, id, userId);
  }

  // --- Photos: the shared album of the event ---

  async uploadPhotos(
    householdId: string,
    id: string,
    userId: string,
    files: Express.Multer.File[] | undefined,
  ) {
    const event = await this.findOne(householdId, id, userId);
    return this.mediaService.upload(householdId, { eventId: event.id }, userId, files);
  }

  async listPhotos(householdId: string, id: string, viewerId: string) {
    const event = await this.findOne(householdId, id, viewerId);
    return this.mediaService.list({ eventId: event.id });
  }

  private async assertExclusionsValid(
    householdId: string,
    creatorId: string | null,
    excludedUserIds: string[],
  ) {
    if (creatorId && excludedUserIds.includes(creatorId)) {
      throw new BadRequestException("The event's creator can't be excluded");
    }
    await this.householdService.assertActiveMembers(householdId, excludedUserIds);
  }

  /** Replaces the exclusion list and drops RSVPs of newly hidden members */
  private async replaceExclusions(
    em: EntityManager,
    eventId: string,
    userIds: string[],
  ) {
    const unique = [...new Set(userIds)];
    await em.delete(EventExclusion, { eventId });
    if (!unique.length) return;
    await em.insert(
      EventExclusion,
      unique.map((userId) => ({ eventId, userId })),
    );
    await em.delete(EventParticipant, { eventId, userId: In(unique) });
  }
}

/** SQL condition: the event is not hidden from the given user */
function visibleTo(alias: string, userParam: string) {
  return `NOT EXISTS (SELECT 1 FROM event_exclusions ex WHERE ex."eventId" = ${alias}.id AND ex."userId" = ${userParam})`;
}

function assertValidRange(startsAt: string, endsAt?: string) {
  if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
    throw new BadRequestException('endsAt must be after startsAt');
  }
}
