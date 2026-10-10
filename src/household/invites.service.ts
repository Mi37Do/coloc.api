import { randomBytes } from 'node:crypto';
import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { HouseholdInvite } from './entities/household-invite.entity.js';
import {
  HouseholdMember,
  MembershipStatus,
} from './entities/household-member.entity.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { activateMembership } from './membership.utils.js';
import { HouseholdService } from './household.service.js';

@Injectable()
export class InvitesService {
  constructor(
    @InjectRepository(HouseholdInvite)
    private readonly invites: Repository<HouseholdInvite>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly householdService: HouseholdService,
  ) {}

  async create(householdId: string, createdById: string, dto: CreateInviteDto) {
    const invite = await this.invites.save(
      this.invites.create({
        householdId,
        createdById,
        token: randomBytes(24).toString('base64url'),
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresInHours
          ? new Date(Date.now() + dto.expiresInHours * 3_600_000)
          : null,
      }),
    );
    return this.withUrl(invite);
  }

  async list(householdId: string) {
    const invites = await this.invites.find({
      where: { householdId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    return invites.map((invite) => this.withUrl(invite));
  }

  async revoke(householdId: string, inviteId: string): Promise<void> {
    const result = await this.invites.update(
      { id: inviteId, householdId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    if (!result.affected) throw new NotFoundException('Invite not found');
  }

  /** Public: what the join page shows before login/sign-up */
  async preview(token: string) {
    const invite = await this.invites.findOne({
      where: { token },
      relations: { household: true },
    });
    this.assertUsable(invite);
    const memberCount = await this.dataSource
      .getRepository(HouseholdMember)
      .count({
        where: {
          householdId: invite.householdId,
          status: MembershipStatus.ACTIVE,
        },
      });
    return {
      household: {
        id: invite.household.id,
        name: invite.household.name,
        city: invite.household.city,
      },
      memberCount,
      expiresAt: invite.expiresAt,
    };
  }

  /** Joins the household. Already-active members don't consume a use. */
  async accept(token: string, userId: string): Promise<HouseholdMember> {
    let joined = false;
    const member = await this.dataSource.transaction(async (em) => {
      // Row lock so two people can't both redeem the last use of a link
      const invite = await em.findOne(HouseholdInvite, {
        where: { token },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertUsable(invite);

      const existing = await em.findOne(HouseholdMember, {
        where: { householdId: invite.householdId, userId },
      });
      if (existing?.status === MembershipStatus.ACTIVE) return existing;

      await em.increment(HouseholdInvite, { id: invite.id }, 'usesCount', 1);
      joined = true;
      return activateMembership(em, invite.householdId, userId);
    });

    if (joined) {
      await this.householdService.announceJoin(member.householdId, userId);
    }
    return member;
  }

  private assertUsable(
    invite: HouseholdInvite | null,
  ): asserts invite is HouseholdInvite {
    if (!invite) throw new NotFoundException('Invite not found');
    const exhausted =
      invite.maxUses !== null && invite.usesCount >= invite.maxUses;
    const expired = invite.expiresAt !== null && invite.expiresAt < new Date();
    if (invite.revokedAt || exhausted || expired) {
      throw new GoneException('This invite link is no longer valid');
    }
  }

  private withUrl(invite: HouseholdInvite) {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    return { ...invite, url: `${appUrl}/join/${invite.token}` };
  }
}
