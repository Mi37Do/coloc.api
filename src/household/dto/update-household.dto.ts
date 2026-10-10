import { PartialType } from '@nestjs/swagger';
import { CreateHouseholdDto } from './create-household.dto.js';

export class UpdateHouseholdDto extends PartialType(CreateHouseholdDto) {}
