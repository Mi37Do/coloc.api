import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { BillsService } from './bills.service.js';
import { CreateBillDto } from './dto/create-bill.dto.js';
import { UpdateBillDto } from './dto/update-bill.dto.js';
import {
  assertOwnerOrAdmin,
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/bills')
export class BillsController {
  constructor(private readonly billsService: BillsService) {}

  @Post()
  create(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateBillDto,
  ) {
    return this.billsService.create(householdId, me.userId, dto);
  }

  @Get()
  findAll(@Param('householdId') householdId: string) {
    return this.billsService.findAll(householdId);
  }

  // Declared before ':id' so "balances" isn't parsed as an id
  @Get('balances')
  balances(@Param('householdId') householdId: string) {
    return this.billsService.balances(householdId);
  }

  @Get(':id')
  findOne(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billsService.findOne(householdId, id);
  }

  @Patch(':id')
  async update(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @Body() dto: UpdateBillDto,
  ) {
    const bill = await this.billsService.findOne(householdId, id);
    assertOwnerOrAdmin(me, bill.createdById);
    return this.billsService.update(householdId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    const bill = await this.billsService.findOne(householdId, id);
    assertOwnerOrAdmin(me, bill.createdById);
    return this.billsService.remove(householdId, id);
  }

  @Post(':id/shares/:userId/settle')
  @HttpCode(200)
  settle(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.billsService.setSettled(householdId, id, userId, me, true);
  }

  @Delete(':id/shares/:userId/settle')
  unsettle(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.billsService.setSettled(householdId, id, userId, me, false);
  }
}
