import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import {
  HouseholdMember,
  HouseholdRole,
  MembershipStatus,
} from './entities/household-member.entity.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';

const ROLES_KEY = 'householdRoles';

/** Restricts a household route to the given roles (use with HouseholdMemberGuard) */
export const HouseholdRoles = (...roles: HouseholdRole[]) =>
  SetMetadata(ROLES_KEY, roles);

export interface HouseholdRequest {
  user: AuthUser;
  params: Record<string, string>;
  membership?: HouseholdMember;
}

/** The caller's membership, set by HouseholdMemberGuard */
export const Membership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): HouseholdMember =>
    ctx.switchToHttp().getRequest<HouseholdRequest>().membership!,
);

/** Only the author of a record or a household admin may change/delete it */
export function assertOwnerOrAdmin(
  membership: HouseholdMember,
  createdById: string | null,
) {
  if (
    membership.role !== HouseholdRole.ADMIN &&
    membership.userId !== createdById
  ) {
    throw new ForbiddenException('Only the creator or an admin can do this');
  }
}

/**
 * Lets the request through only if the caller is an active member of
 * the household in `:householdId`. Attaches the membership to the request.
 */
@Injectable()
export class HouseholdMemberGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(HouseholdMember)
    private readonly members: Repository<HouseholdMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<HouseholdRequest>();
    const householdId = req.params.householdId;

    // 404 rather than 403 so outsiders can't probe which households exist
    if (!householdId || !isUUID(householdId)) {
      throw new NotFoundException('Household not found');
    }
    const membership = await this.members.findOne({
      where: {
        householdId,
        userId: req.user.id,
        status: MembershipStatus.ACTIVE,
      },
    });
    if (!membership) throw new NotFoundException('Household not found');

    const roles = this.reflector.getAllAndOverride<HouseholdRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (roles?.length && !roles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient household role');
    }

    req.membership = membership;
    return true;
  }
}
