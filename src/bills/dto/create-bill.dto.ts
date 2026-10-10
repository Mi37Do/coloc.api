import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsISO4217CurrencyCode,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BillCategory } from '../entities/bill.entity.js';

export enum SplitType {
  /** Divide evenly between participantIds (default: every active member) */
  EQUAL = 'equal',
  /** Explicit amounts in `shares`, must add up to amountCents */
  CUSTOM = 'custom',
}

export class ShareInputDto {
  @IsUUID()
  userId: string;

  @IsInt()
  @Min(0)
  amountCents: number;
}

export class CreateBillDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsEnum(BillCategory)
  category?: BillCategory;

  @IsInt()
  @Min(1)
  @Max(100_000_000)
  amountCents: number;

  @IsOptional()
  @IsISO4217CurrencyCode()
  currency?: string;

  /** Defaults to the current user */
  @IsOptional()
  @IsUUID()
  paidById?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsEnum(SplitType)
  split: SplitType;

  @ValidateIf((dto: CreateBillDto) => dto.split === SplitType.EQUAL)
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  participantIds?: string[];

  @ValidateIf((dto: CreateBillDto) => dto.split === SplitType.CUSTOM)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShareInputDto)
  shares?: ShareInputDto[];
}
