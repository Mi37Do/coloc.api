import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service.js';
import { CreateReminderDto, ListRemindersDto } from './dto/reminder.dto.js';
import {
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/reminders')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  create(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateReminderDto,
  ) {
    return this.schedulesService.create(householdId, me.userId, dto);
  }

  @Get()
  findAll(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Query() query: ListRemindersDto,
  ) {
    return this.schedulesService.findAll(householdId, me.userId, query);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.schedulesService.cancel(householdId, id, me);
  }
}
