import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateBillDto, SplitType } from './dto/create-bill.dto.js';
import { UpdateBillDto } from './dto/update-bill.dto.js';
import { Bill } from './entities/bill.entity.js';
import { BillShare } from './entities/bill-share.entity.js';
import { HouseholdService } from '../household/household.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import {
  HouseholdMember,
  HouseholdRole,
} from '../household/entities/household-member.entity.js';

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

export interface Debt {
  fromUserId: string;
  toUserId: string;
  amountCents: number;
}

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(Bill) private readonly bills: Repository<Bill>,
    @InjectRepository(BillShare)
    private readonly shares: Repository<BillShare>,
    private readonly householdService: HouseholdService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(householdId: string, userId: string, dto: CreateBillDto) {
    const paidById = dto.paidById ?? userId;
    const splits = await this.computeSplits(householdId, dto);
    await this.householdService.assertActiveMembers(householdId, [
      paidById,
      ...splits.map((s) => s.userId),
    ]);

    const now = new Date();
    const bill = await this.bills.save(
      this.bills.create({
        householdId,
        title: dto.title,
        category: dto.category,
        amountCents: dto.amountCents,
        currency: dto.currency?.toUpperCase(),
        dueDate: dto.dueDate ?? null,
        paidById,
        createdById: userId,
        shares: splits.map((s) =>
          this.shares.create({
            ...s,
            // Nobody owes themselves
            settledAt: s.userId === paidById ? now : null,
          }),
        ),
      }),
    );

    await this.notifications.notify(
      splits.map((s) => s.userId).filter((id) => id !== userId),
      {
        type: NotificationType.BILL_CREATED,
        title: `New bill: ${bill.title}`,
        householdId,
        data: { billId: bill.id, paidById },
      },
    );
    return this.findOne(householdId, bill.id);
  }

  findAll(householdId: string) {
    return this.bills.find({
      where: { householdId },
      relations: { paidBy: true, shares: true },
      select: { paidBy: PUBLIC_USER },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(householdId: string, id: string) {
    const bill = await this.bills.findOne({
      where: { id, householdId },
      relations: { paidBy: true, shares: { user: true } },
      // A nested select only loads the columns it lists
      select: {
        paidBy: PUBLIC_USER,
        shares: {
          id: true,
          userId: true,
          amountCents: true,
          settledAt: true,
          user: PUBLIC_USER,
        },
      },
    });
    if (!bill) throw new NotFoundException('Bill not found');
    return bill;
  }

  async update(householdId: string, id: string, dto: UpdateBillDto) {
    const bill = await this.findOne(householdId, id);
    await this.bills.update(bill.id, {
      ...dto,
      ...(dto.dueDate !== undefined && { dueReminderSentAt: null }),
    });
    return this.findOne(householdId, id);
  }

  async remove(householdId: string, id: string) {
    await this.bills.delete({ id, householdId });
  }

  /** The debtor, the payer, or an admin can mark a share as paid back */
  async setSettled(
    householdId: string,
    billId: string,
    userId: string,
    me: HouseholdMember,
    settled: boolean,
  ) {
    const bill = await this.findOne(householdId, billId);
    const share = bill.shares.find((s) => s.userId === userId);
    if (!share) throw new NotFoundException('Share not found');
    if (share.userId === bill.paidById) {
      throw new BadRequestException("The payer's own share is always settled");
    }
    const allowed =
      me.role === HouseholdRole.ADMIN ||
      me.userId === share.userId ||
      me.userId === bill.paidById;
    if (!allowed) {
      throw new ForbiddenException('Only the debtor or payer can do this');
    }

    await this.shares.update(share.id, {
      settledAt: settled ? new Date() : null,
    });
    return this.findOne(householdId, billId);
  }

  /**
   * Who owes whom across all unsettled shares, netted per pair
   * (A owes B 10, B owes A 4 → A owes B 6), plus each member's net balance.
   */
  async balances(householdId: string) {
    const rows = await this.shares
      .createQueryBuilder('share')
      .innerJoin('share.bill', 'bill')
      .select('share.userId', 'fromUserId')
      .addSelect('bill.paidById', 'toUserId')
      .addSelect('bill.currency', 'currency')
      .addSelect('SUM(share.amountCents)::int', 'amountCents')
      .where('bill.householdId = :householdId', { householdId })
      .andWhere('share.settledAt IS NULL')
      .andWhere('bill.paidById IS NOT NULL')
      .andWhere('share.userId <> bill.paidById')
      .groupBy('share.userId')
      .addGroupBy('bill.paidById')
      .addGroupBy('bill.currency')
      .getRawMany<Debt & { currency: string }>();

    const byCurrency = new Map<string, typeof rows>();
    for (const row of rows) {
      byCurrency.set(row.currency, [...(byCurrency.get(row.currency) ?? []), row]);
    }

    return [...byCurrency].map(([currency, debts]) => {
      const pair = new Map<string, number>();
      const net = new Map<string, number>();
      for (const { fromUserId, toUserId, amountCents } of debts) {
        // Store each pair once, in a stable direction
        const [a, b, sign] =
          fromUserId < toUserId
            ? [fromUserId, toUserId, 1]
            : [toUserId, fromUserId, -1];
        const key = `${a}|${b}`;
        pair.set(key, (pair.get(key) ?? 0) + sign * amountCents);
        net.set(fromUserId, (net.get(fromUserId) ?? 0) - amountCents);
        net.set(toUserId, (net.get(toUserId) ?? 0) + amountCents);
      }

      const owes: Debt[] = [];
      for (const [key, amount] of pair) {
        if (amount === 0) continue;
        const [a, b] = key.split('|');
        owes.push(
          amount > 0
            ? { fromUserId: a, toUserId: b, amountCents: amount }
            : { fromUserId: b, toUserId: a, amountCents: -amount },
        );
      }
      return {
        currency,
        // Positive: the household owes them. Negative: they owe.
        members: [...net].map(([userId, netCents]) => ({ userId, netCents })),
        owes,
      };
    });
  }

  private async computeSplits(householdId: string, dto: CreateBillDto) {
    if (dto.split === SplitType.CUSTOM) {
      const shares = dto.shares ?? [];
      const userIds = shares.map((s) => s.userId);
      if (new Set(userIds).size !== userIds.length) {
        throw new BadRequestException('Each member can only appear once');
      }
      const total = shares.reduce((sum, s) => sum + s.amountCents, 0);
      if (total !== dto.amountCents) {
        throw new BadRequestException(
          `Shares add up to ${total}, expected ${dto.amountCents}`,
        );
      }
      return shares;
    }

    const participants = [
      ...new Set(
        dto.participantIds ??
          (await this.householdService.activeMemberIds(householdId)),
      ),
    ];
    // Spread leftover cents over the first participants: 1000 / 3 → 334, 333, 333
    const base = Math.floor(dto.amountCents / participants.length);
    const remainder = dto.amountCents % participants.length;
    return participants.map((userId, i) => ({
      userId,
      amountCents: base + (i < remainder ? 1 : 0),
    }));
  }
}
