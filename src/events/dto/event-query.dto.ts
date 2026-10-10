import { IsDateString, IsEnum, IsOptional } from 'class-validator';
import { RsvpResponse } from '../entities/event-participant.entity.js';

export class ListEventsDto {
  /** Defaults to now: upcoming events only */
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}

export class RsvpDto {
  @IsEnum(RsvpResponse)
  response: RsvpResponse;
}
