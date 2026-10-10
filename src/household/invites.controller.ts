import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { InvitesService } from './invites.service.js';
import { HouseholdService } from './household.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';

/** Join links: the frontend's /join/:token page talks to these */
@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  /** Join by short code, typed in the app: "K7Q-M2X", dash optional */
  @Public()
  @Get('code/:code')
  previewByCode(@Param('code') code: string) {
    return this.invitesService.previewByCode(code);
  }

  @ApiBearerAuth()
  @Post('code/:code/accept')
  @HttpCode(200)
  acceptByCode(@Param('code') code: string, @CurrentUser() user: AuthUser) {
    return this.invitesService.acceptByCode(code, user.id);
  }

  @Public()
  @Get(':token')
  preview(@Param('token') token: string) {
    return this.invitesService.preview(token);
  }

  @ApiBearerAuth()
  @Post(':token/accept')
  @HttpCode(200)
  accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invitesService.accept(token, user.id);
  }
}

/** Direct invitations received by the current user */
@ApiBearerAuth()
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser) {
    return this.householdService.myInvitations(user.id);
  }

  @Post(':householdId/accept')
  @HttpCode(200)
  accept(
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.householdService.acceptInvitation(householdId, user.id);
  }

  @Delete(':householdId')
  @HttpCode(204)
  decline(
    @Param('householdId', ParseUUIDPipe) householdId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.householdService.declineInvitation(householdId, user.id);
  }
}
