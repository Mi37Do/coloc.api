import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto.js';

export class RegisterDto extends CreateUserDto {
  @IsString()
  @Length(8, 72) // bcrypt ignores bytes past 72
  password: string;

  /** Token from an invite link; joins that household right after sign-up */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteToken?: string;
}
