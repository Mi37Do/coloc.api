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
  Put,
  Query,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';
import { UpdateEventDto } from './dto/update-event.dto.js';
import { ListEventsDto, RsvpDto } from './dto/event-query.dto.js';
import {
  assertOwnerOrAdmin,
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';
import { ImageUpload } from '../media/image-upload.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateEventDto,
  ) {
    return this.eventsService.create(householdId, me.userId, dto);
  }

  @Get()
  findAll(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Query() query: ListEventsDto,
  ) {
    return this.eventsService.findAll(householdId, me.userId, query);
  }

  @Get(':id')
  findOne(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.eventsService.findOne(householdId, id, me.userId);
  }

  @Patch(':id')
  async update(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @Body() dto: UpdateEventDto,
  ) {
    await this.assertCanManage(householdId, id, me);
    return this.eventsService.update(householdId, id, me.userId, dto);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    await this.assertCanManage(householdId, id, me);
    return this.eventsService.setCancelled(householdId, id, me.userId, true);
  }

  @Delete(':id/cancel')
  async uncancel(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    await this.assertCanManage(householdId, id, me);
    return this.eventsService.setCancelled(householdId, id, me.userId, false);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    await this.assertCanManage(householdId, id, me);
    return this.eventsService.remove(householdId, id, me.userId);
  }

  /** Answer going / maybe / declined; calling again changes the answer */
  @Put(':id/rsvp')
  rsvp(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @Body() { response }: RsvpDto,
  ) {
    return this.eventsService.rsvp(householdId, id, me.userId, response);
  }

  // --- Shared photo album (any member who can see the event) ---

  @Post(':id/photos')
  @ImageUpload()
  uploadPhotos(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.eventsService.uploadPhotos(householdId, id, me.userId, files);
  }

  @Get(':id/photos')
  listPhotos(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.eventsService.listPhotos(householdId, id, me.userId);
  }

  private async assertCanManage(
    householdId: string,
    id: string,
    me: HouseholdMember,
  ) {
    const event = await this.eventsService.findOne(householdId, id, me.userId);
    assertOwnerOrAdmin(me, event.createdById);
  }
}
