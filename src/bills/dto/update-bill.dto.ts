import { PartialType, PickType } from '@nestjs/swagger';
import { CreateBillDto } from './create-bill.dto.js';

/** Amount and split are fixed once created; delete and recreate to change them */
export class UpdateBillDto extends PartialType(
  PickType(CreateBillDto, ['title', 'category', 'dueDate'] as const),
) {}
