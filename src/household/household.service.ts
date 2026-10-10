import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CreateHouseholdDto } from './dto/create-household.dto.js';
import { UpdateHouseholdDto } from './dto/update-household.dto.js';
import { Household } from './entities/household.entity.js';
import {
  HouseholdMember,
  HouseholdRole,
  MembershipStatus,
} from './entities/household-member.entity.js';
import { User } from '../users/entities/user.entity.js';
import { activateMembership } from './membership.utils.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';

const PUBLIC_USER_FIELDS = {
  id: true,
  username: true,
  firstname: true,
  lastname: true,
} as const;

@Injectable()
export class HouseholdService {
  constructor(
    @InjectRepository(Household)
    private readonly households: Repository<Household>,
    @InjectRepository(HouseholdMember)
    private readonly members: Repository<HouseholdMember>,
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  /** The creator becomes the first admin */
  create(userId: string, dto: CreateHouseholdDto): Promise<Household> {
    return this.dataSource.transaction(async (em) => {
      const household = await em.save(em.create(Household, dto));
      await activateMembership(em, household.id, userId, HouseholdRole.ADMIN);
      return household;
    });
  }

  findMine(userId: string): Promise<Household[]> {
    return this.households
      .createQueryBuilder('household')
      .innerJoin(
        'household.members',
        'member',
        'member.userId = :userId AND member.status = :status',
        { userId, status: MembershipStatus.ACTIVE },
      )
      .orderBy('household.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string): Promise<Household> {
    const household = await this.households.findOne({ where: { id } });
    if (!household) throw new NotFoundException('Household not found');
    return household;
  }

  async update(id: string, dto: UpdateHouseholdDto): Promise<Household> {
    await this.households.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.households.delete(id);
  }

  listMembers(householdId: string): Promise<HouseholdMember[]> {
    return this.members.find({
      where: { householdId, status: MembershipStatus.ACTIVE },
      relations: { user: true },
      select: { user: PUBLIC_USER_FIELDS },
      order: { joinedAt: 'ASC' },
    });
  }

  /** Active member ids, oldest member first */
  async activeMemberIds(householdId: string): Promise<string[]> {
    const members = await this.members.find({
      select: { userId: true },
      where: { householdId, status: MembershipStatus.ACTIVE },
      order: { joinedAt: 'ASC' },
    });
    return members.map((m) => m.userId);
  }

  /** For assignees, bill participants, etc. */
  async assertActiveMembers(
    householdId: string,
    userIds: string[],
  ): Promise<void> {
    const unique = [...new Set(userIds)];
    if (!unique.length) return;
    const count = await this.members.count({
      where: {
        householdId,
        userId: In(unique),
        status: MembershipStatus.ACTIVE,
      },
    });
    if (count !== unique.length) {
      throw new BadRequestException(
        'All users must be active members of the household',
      );
    }
  }

  // --- Direct invitations (search a user, invite, they accept) ---

  async inviteUser(
    householdId: string,
    invitedById: string,
    userId: string,
  ): Promise<HouseholdMember> {
    const userExists = await this.dataSource
      .getRepository(User)
      .exists({ where: { id: userId } });
    if (!userExists) throw new NotFoundException('User not found');

    const existing = await this.members.findOne({
      where: { householdId, userId },
    });
    if (existing?.status === MembershipStatus.ACTIVE) {
      throw new ConflictException('User is already a member');
    }
    if (existing?.status === MembershipStatus.PENDING) return existing;

    const invitation = await this.members.save(
      this.members.merge(
        existing ?? this.members.create({ householdId, userId }),
        {
          status: MembershipStatus.PENDING,
          role: HouseholdRole.MEMBER,
          invitedById,
          joinedAt: null,
        },
      ),
    );

    const household = await this.findOne(householdId);
    await this.notifications.notify([userId], {
      type: NotificationType.HOUSEHOLD_INVITE,
      title: `You're invited to join ${household.name}`,
      householdId,
      data: { householdId, invitedById },
    });
    return invitation;
  }

  /** Pending invitations shown to the invited user */
  myInvitations(userId: string): Promise<HouseholdMember[]> {
    return this.members.find({
      where: { userId, status: MembershipStatus.PENDING },
      relations: { household: true, invitedBy: true },
      select: {
        household: { id: true, name: true, city: true },
        invitedBy: PUBLIC_USER_FIELDS,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async acceptInvitation(
    householdId: string,
    userId: string,
  ): Promise<HouseholdMember> {
    await this.findPending(householdId, userId);
    const member = await this.dataSource.transaction((em) =>
      activateMembership(em, householdId, userId),
    );
    await this.announceJoin(householdId, userId);
    return member;
  }

  /** Tells the other members someone joined */
  async announceJoin(householdId: string, userId: string) {
    const user = await this.dataSource
      .getRepository(User)
      .findOneBy({ id: userId });
    await this.notifications.notifyHousehold(
      householdId,
      {
        type: NotificationType.MEMBER_JOINED,
        title: `${user?.firstname ?? 'Someone'} joined the household`,
        data: { userId },
      },
      [userId],
    );
  }

  async declineInvitation(householdId: string, userId: string): Promise<void> {
    const pending = await this.findPending(householdId, userId);
    await this.members.delete(pending.id);
  }

  async cancelInvitation(householdId: string, userId: string): Promise<void> {
    const pending = await this.findPending(householdId, userId);
    await this.members.delete(pending.id);
  }

  // --- Membership management ---

  async leave(householdId: string, userId: string): Promise<void> {
    const member = await this.findActive(householdId, userId);
    const others = await this.members.count({
      where: { householdId, status: MembershipStatus.ACTIVE },
    });

    // Last one out removes the household
    if (others <= 1) return this.remove(householdId);

    await this.assertNotLastAdmin(member);
    await this.members.update(member.id, { status: MembershipStatus.LEFT });
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    const member = await this.findActive(householdId, userId);
    await this.assertNotLastAdmin(member);
    await this.members.update(member.id, { status: MembershipStatus.LEFT });
  }

  async updateRole(
    householdId: string,
    userId: string,
    role: HouseholdRole,
  ): Promise<HouseholdMember> {
    const member = await this.findActive(householdId, userId);
    if (role !== HouseholdRole.ADMIN) await this.assertNotLastAdmin(member);
    member.role = role;
    return this.members.save(member);
  }

  private async findActive(householdId: string, userId: string) {
    const member = await this.members.findOne({
      where: { householdId, userId, status: MembershipStatus.ACTIVE },
    });
    if (!member) throw new NotFoundException('Member not found');
    return member;
  }

  private async findPending(householdId: string, userId: string) {
    const pending = await this.members.findOne({
      where: { householdId, userId, status: MembershipStatus.PENDING },
    });
    if (!pending) throw new NotFoundException('Invitation not found');
    return pending;
  }

  private async assertNotLastAdmin(member: HouseholdMember) {
    if (member.role !== HouseholdRole.ADMIN) return;
    const admins = await this.members.count({
      where: {
        householdId: member.householdId,
        role: HouseholdRole.ADMIN,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (admins <= 1) {
      throw new BadRequestException(
        'Promote another member to admin first',
      );
    }
  }
}
