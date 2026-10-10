import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AlertsService } from './alerts.service.js';
import { CreateAlertDto, ListAlertsDto } from './dto/alert.dto.js';
import {
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  create(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateAlertDto,
  ) {
    return this.alertsService.create(householdId, me.userId, dto);
  }

  @Get()
  findAll(
    @Param('householdId') householdId: string,
    @Query() query: ListAlertsDto,
  ) {
    return this.alertsService.findAll(householdId, query);
  }

  @Get(':id')
  findOne(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.alertsService.findOne(householdId, id);
  }

  @Post(':id/ack')
  @HttpCode(200)
  acknowledge(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.alertsService.acknowledge(householdId, id, me.userId);
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.alertsService.resolve(householdId, id, me.userId);
  }
}
