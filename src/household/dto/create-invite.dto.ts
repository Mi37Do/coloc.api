import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateInviteDto {
  /** Omit for a permanent link, 1 for single use */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses?: number;

  /** Omit for no expiry */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24 * 90)
  expiresInHours?: number;
}
