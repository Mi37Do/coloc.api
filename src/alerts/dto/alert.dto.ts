import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AlertType } from '../entities/alert.entity.js';

export class CreateAlertDto {
  @IsEnum(AlertType)
  type: AlertType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;
}

export class ListAlertsDto {
  /** true = only unresolved alerts */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  active?: boolean;
}
