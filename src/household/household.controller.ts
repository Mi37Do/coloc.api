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
import { HouseholdService } from './household.service.js';
import { InvitesService } from './invites.service.js';
import { CreateHouseholdDto } from './dto/create-household.dto.js';
import { UpdateHouseholdDto } from './dto/update-household.dto.js';
import { CreateInviteDto } from './dto/create-invite.dto.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { HouseholdRole } from './entities/household-member.entity.js';
import {
  HouseholdMemberGuard,
  HouseholdRoles,
} from './household-member.guard.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';

const Admin = HouseholdRoles(HouseholdRole.ADMIN);

@ApiBearerAuth()
@Controller('households')
export class HouseholdController {
  constructor(
    private readonly householdService: HouseholdService,
    private readonly invitesService: InvitesService,
  ) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateHouseholdDto) {
    return this.householdService.create(user.id, dto);
  }

  @Get()
  findMine(@CurrentUser() user: AuthUser) {
    return this.householdService.findMine(user.id);
  }

  @UseGuards(HouseholdMemberGuard)
  @Get(':householdId')
  findOne(@Param('householdId') householdId: string) {
    return this.householdService.findOne(householdId);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Patch(':householdId')
  update(
    @Param('householdId') householdId: string,
    @Body() dto: UpdateHouseholdDto,
  ) {
    return this.householdService.update(householdId, dto);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Delete(':householdId')
  @HttpCode(204)
  remove(@Param('householdId') householdId: string) {
    return this.householdService.remove(householdId);
  }

  // --- Members ---

  @UseGuards(HouseholdMemberGuard)
  @Get(':householdId/members')
  listMembers(@Param('householdId') householdId: string) {
    return this.householdService.listMembers(householdId);
  }

  @UseGuards(HouseholdMemberGuard)
  @Post(':householdId/leave')
  @HttpCode(204)
  leave(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.householdService.leave(householdId, user.id);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Delete(':householdId/members/:userId')
  @HttpCode(204)
  removeMember(
    @Param('householdId') householdId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.householdService.removeMember(householdId, userId);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Patch(':householdId/members/:userId/role')
  updateRole(
    @Param('householdId') householdId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() { role }: UpdateMemberRoleDto,
  ) {
    return this.householdService.updateRole(householdId, userId, role);
  }

  // --- Direct invitations (any member can invite) ---

  @UseGuards(HouseholdMemberGuard)
  @Post(':householdId/invitations')
  inviteUser(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthUser,
    @Body() { userId }: InviteUserDto,
  ) {
    return this.householdService.inviteUser(householdId, user.id, userId);
  }

  @UseGuards(HouseholdMemberGuard)
  @Delete(':householdId/invitations/:userId')
  @HttpCode(204)
  cancelInvitation(
    @Param('householdId') householdId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.householdService.cancelInvitation(householdId, userId);
  }

  // --- Invite links (admins manage them) ---

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Post(':householdId/invite-links')
  createInvite(
    @Param('householdId') householdId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInviteDto,
  ) {
    return this.invitesService.create(householdId, user.id, dto);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Get(':householdId/invite-links')
  listInvites(@Param('householdId') householdId: string) {
    return this.invitesService.list(householdId);
  }

  @UseGuards(HouseholdMemberGuard)
  @Admin
  @Delete(':householdId/invite-links/:inviteId')
  @HttpCode(204)
  revokeInvite(
    @Param('householdId') householdId: string,
    @Param('inviteId', ParseUUIDPipe) inviteId: string,
  ) {
    return this.invitesService.revoke(householdId, inviteId);
  }
}
