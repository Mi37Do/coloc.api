import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(512)
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;
}
