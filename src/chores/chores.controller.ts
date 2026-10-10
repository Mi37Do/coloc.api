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
  Query,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ImageUpload } from '../media/image-upload.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ChoresService } from './chores.service.js';
import { CreateChoreDto } from './dto/create-chore.dto.js';
import { UpdateChoreDto } from './dto/update-chore.dto.js';
import { ListChoresDto } from './dto/list-chores.dto.js';
import {
  assertOwnerOrAdmin,
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/chores')
export class ChoresController {
  constructor(private readonly choresService: ChoresService) {}

  @Post()
  create(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateChoreDto,
  ) {
    return this.choresService.create(householdId, me.userId, dto);
  }

  @Get()
  findAll(
    @Param('householdId') householdId: string,
    @Query() filters: ListChoresDto,
  ) {
    return this.choresService.findAll(householdId, filters);
  }

  @Get(':id')
  findOne(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.choresService.findOne(householdId, id);
  }

  @Patch(':id')
  update(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @Body() dto: UpdateChoreDto,
  ) {
    return this.choresService.update(householdId, id, me.userId, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    const chore = await this.choresService.findOne(householdId, id);
    assertOwnerOrAdmin(me, chore.createdById);
    return this.choresService.remove(householdId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  complete(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.choresService.complete(householdId, id, me.userId);
  }

  @Post(':id/images')
  @ImageUpload()
  uploadImages(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Membership() me: HouseholdMember,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.choresService.uploadImages(householdId, id, me.userId, files);
  }

  @Get(':id/images')
  listImages(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.choresService.listImages(householdId, id);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  reopen(
    @Param('householdId') householdId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.choresService.reopen(householdId, id);
  }
}
