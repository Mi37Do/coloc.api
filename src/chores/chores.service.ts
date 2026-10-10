import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreateChoreDto } from './dto/create-chore.dto.js';
import { UpdateChoreDto } from './dto/update-chore.dto.js';
import { ListChoresDto } from './dto/list-chores.dto.js';
import {
  Chore,
  ChoreRecurrence,
  ChoreStatus,
} from './entities/chore.entity.js';
import { HouseholdService } from '../household/household.service.js';
import { MediaService } from '../media/media.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

@Injectable()
export class ChoresService {
  constructor(
    @InjectRepository(Chore) private readonly chores: Repository<Chore>,
    private readonly householdService: HouseholdService,
    private readonly mediaService: MediaService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(householdId: string, userId: string, dto: CreateChoreDto) {
    if (dto.assigneeId) {
      await this.householdService.assertActiveMembers(householdId, [
        dto.assigneeId,
      ]);
    }
    this.assertRotationValid(dto.recurrence, dto.rotateAssignee);
    const chore = await this.chores.save(
      this.chores.create({ ...dto, householdId, createdById: userId }),
    );
    await this.notifyAssignee(chore, userId);
    return this.findOne(householdId, chore.id);
  }

  findAll(householdId: string, { status, assigneeId }: ListChoresDto) {
    return this.chores.find({
      // TypeORM rejects undefined in where clauses, so only set what was sent
      where: {
        householdId,
        ...(status && { status }),
        ...(assigneeId && { assigneeId }),
      },
      relations: { assignee: true },
      select: { assignee: PUBLIC_USER },
      // Postgres sorts enums by declaration order: todo first. Undated chores last.
      order: { status: 'ASC', dueAt: { direction: 'ASC', nulls: 'LAST' } },
    });
  }

  async findOne(householdId: string, id: string) {
    const chore = await this.chores.findOne({
      where: { id, householdId },
      relations: { assignee: true, completedBy: true, createdBy: true },
      select: {
        assignee: PUBLIC_USER,
        completedBy: PUBLIC_USER,
        createdBy: PUBLIC_USER,
      },
    });
    if (!chore) throw new NotFoundException('Chore not found');
    return chore;
  }

  async update(
    householdId: string,
    id: string,
    userId: string,
    dto: UpdateChoreDto,
  ) {
    const chore = await this.findOne(householdId, id);
    if (dto.assigneeId) {
      await this.householdService.assertActiveMembers(householdId, [
        dto.assigneeId,
      ]);
    }
    this.assertRotationValid(
      dto.recurrence ?? chore.recurrence,
      dto.rotateAssignee ?? chore.rotateAssignee,
    );
    await this.chores.update(chore.id, {
      ...dto,
      // A new due date deserves a new "due soon" reminder
      ...(dto.dueAt !== undefined && { dueReminderSentAt: null }),
    });
    const updated = await this.findOne(householdId, id);
    if (dto.assigneeId && dto.assigneeId !== chore.assigneeId) {
      await this.notifyAssignee(updated, userId);
    }
    return updated;
  }

  async remove(householdId: string, id: string) {
    const chore = await this.findOne(householdId, id);
    await this.mediaService.removeAllFor({ choreId: chore.id });
    await this.chores.delete(chore.id);
  }

  // --- Images (e.g. "before/after" or proof it's done) ---

  async uploadImages(
    householdId: string,
    id: string,
    userId: string,
    files: Express.Multer.File[] | undefined,
  ) {
    const chore = await this.findOne(householdId, id);
    return this.mediaService.upload(householdId, { choreId: chore.id }, userId, files);
  }

  async listImages(householdId: string, id: string) {
    const chore = await this.findOne(householdId, id);
    return this.mediaService.list({ choreId: chore.id });
  }

  /**
   * Marks the chore done. A recurring chore spawns its next occurrence,
   * handed to the next member when rotation is on.
   */
  async complete(householdId: string, id: string, userId: string) {
    const chore = await this.findOne(householdId, id);
    if (chore.status === ChoreStatus.DONE) return chore;

    const next = await this.dataSource.transaction(async (em) => {
      await em.update(Chore, chore.id, {
        status: ChoreStatus.DONE,
        completedAt: new Date(),
        completedById: userId,
      });
      if (chore.recurrence === ChoreRecurrence.NONE) return null;

      return em.save(
        em.create(Chore, {
          householdId,
          title: chore.title,
          description: chore.description,
          recurrence: chore.recurrence,
          rotateAssignee: chore.rotateAssignee,
          createdById: chore.createdById,
          dueAt: nextDueDate(chore.dueAt ?? new Date(), chore.recurrence),
          assigneeId: chore.rotateAssignee
            ? await this.nextAssignee(householdId, chore.assigneeId)
            : chore.assigneeId,
        }),
      );
    });

    // With rotation, the next occurrence lands on someone new
    if (next && chore.rotateAssignee) await this.notifyAssignee(next, userId);
    return this.findOne(householdId, id);
  }

  async reopen(householdId: string, id: string) {
    const chore = await this.findOne(householdId, id);
    await this.chores.update(chore.id, {
      status: ChoreStatus.TODO,
      completedAt: null,
      completedById: null,
    });
    return this.findOne(householdId, id);
  }

  /** Nobody gets notified about a chore they assigned to themselves */
  private async notifyAssignee(chore: Chore, actorId: string) {
    if (!chore.assigneeId || chore.assigneeId === actorId) return;
    await this.notifications.notify([chore.assigneeId], {
      type: NotificationType.CHORE_ASSIGNED,
      title: `New chore for you: ${chore.title}`,
      householdId: chore.householdId,
      data: { choreId: chore.id, dueAt: chore.dueAt },
    });
  }

  private async nextAssignee(householdId: string, current: string | null) {
    const ids = await this.householdService.activeMemberIds(householdId);
    if (!ids.length) return null;
    const index = current ? ids.indexOf(current) : -1;
    return ids[(index + 1) % ids.length];
  }

  private assertRotationValid(
    recurrence = ChoreRecurrence.NONE,
    rotate = false,
  ) {
    if (rotate && recurrence === ChoreRecurrence.NONE) {
      throw new BadRequestException(
        'rotateAssignee only applies to recurring chores',
      );
    }
  }
}

function nextDueDate(from: Date, recurrence: ChoreRecurrence): Date {
  const next = new Date(from);
  if (recurrence === ChoreRecurrence.DAILY) next.setDate(next.getDate() + 1);
  if (recurrence === ChoreRecurrence.WEEKLY) next.setDate(next.getDate() + 7);
  if (recurrence === ChoreRecurrence.MONTHLY) next.setMonth(next.getMonth() + 1);
  return next;
}
