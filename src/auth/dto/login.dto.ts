import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  /** Email or username */
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;

  /** Token from an invite link; joins that household right after login */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteToken?: string;
}
