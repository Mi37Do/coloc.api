import { PartialType } from '@nestjs/swagger';
import { CreateChoreDto } from './create-chore.dto.js';

export class UpdateChoreDto extends PartialType(CreateChoreDto) {}
