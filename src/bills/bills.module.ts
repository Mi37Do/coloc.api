import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillsService } from './bills.service.js';
import { BillsController } from './bills.controller.js';
import { Bill } from './entities/bill.entity.js';
import { BillShare } from './entities/bill-share.entity.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Bill, BillShare]), HouseholdModule],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService],
})
export class BillsModule {}
