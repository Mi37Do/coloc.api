import { IsEnum } from 'class-validator';
import { HouseholdRole } from '../entities/household-member.entity.js';

export class UpdateMemberRoleDto {
  @IsEnum(HouseholdRole)
  role: HouseholdRole;
}
