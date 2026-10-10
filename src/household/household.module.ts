import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HouseholdService } from './household.service.js';
import { InvitesService } from './invites.service.js';
import { HouseholdController } from './household.controller.js';
import {
  InvitationsController,
  InvitesController,
} from './invites.controller.js';
import { HouseholdMemberGuard } from './household-member.guard.js';
import { Household } from './entities/household.entity.js';
import { HouseholdMember } from './entities/household-member.entity.js';
import { HouseholdInvite } from './entities/household-invite.entity.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Household, HouseholdMember, HouseholdInvite]),
    NotificationsModule,
  ],
  controllers: [HouseholdController, InvitesController, InvitationsController],
  providers: [HouseholdService, InvitesService, HouseholdMemberGuard],
  // Feature modules (chores, bills, ...) import this for the guard and notifications
  exports: [
    HouseholdService,
    InvitesService,
    HouseholdMemberGuard,
    TypeOrmModule,
    NotificationsModule,
  ],
})
export class HouseholdModule {}
