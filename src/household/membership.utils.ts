import { EntityManager } from 'typeorm';
import {
  HouseholdMember,
  HouseholdRole,
  MembershipStatus,
} from './entities/household-member.entity.js';

/**
 * Makes the user an active member, reusing their previous row if they
 * were invited before or left earlier (one row per household/user).
 */
export async function activateMembership(
  em: EntityManager,
  householdId: string,
  userId: string,
  role = HouseholdRole.MEMBER,
): Promise<HouseholdMember> {
  const repo = em.getRepository(HouseholdMember);
  const existing = await repo.findOne({ where: { householdId, userId } });
  if (existing?.status === MembershipStatus.ACTIVE) return existing;

  return repo.save(
    repo.merge(existing ?? repo.create({ householdId, userId }), {
      role: existing?.status === MembershipStatus.PENDING ? existing.role : role,
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    }),
  );
}
