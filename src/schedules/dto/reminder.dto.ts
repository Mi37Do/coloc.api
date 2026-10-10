import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReminderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsDateString()
  remindAt: string;

  /** Omit to remind every member; use your own id for a personal reminder */
  @IsOptional()
  @IsUUID()
  forUserId?: string;
}

export class ListRemindersDto {
  /** true = include already sent and cancelled reminders */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  all?: boolean;
}
