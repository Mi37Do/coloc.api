import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MediaService } from './media.service.js';
import {
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

/** Upload/list routes live on chores and events; these act on a single file */
@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get(':mediaId/file')
  @Header('Cache-Control', 'private, max-age=86400')
  file(
    @Param('householdId') householdId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.mediaService.open(householdId, mediaId, me.userId);
  }

  @Delete(':mediaId')
  @HttpCode(204)
  remove(
    @Param('householdId') householdId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.mediaService.remove(householdId, mediaId, me);
  }
}
