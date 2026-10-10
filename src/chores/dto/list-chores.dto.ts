import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ChoreStatus } from '../entities/chore.entity.js';

export class ListChoresDto {
  @IsOptional()
  @IsEnum(ChoreStatus)
  status?: ChoreStatus;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
