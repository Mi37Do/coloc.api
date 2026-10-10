import { IsUUID } from 'class-validator';

export class InviteUserDto {
  /** From GET /users/search */
  @IsUUID()
  userId: string;
}
