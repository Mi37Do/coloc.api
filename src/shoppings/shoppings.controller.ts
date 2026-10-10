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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ShoppingsService } from './shoppings.service.js';
import {
  CreateShoppingItemDto,
  CreateShoppingListDto,
  ListShoppingListsDto,
  UpdateShoppingItemDto,
  UpdateShoppingListDto,
} from './dto/shopping.dto.js';
import {
  assertOwnerOrAdmin,
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/shopping-lists')
export class ShoppingsController {
  constructor(private readonly shoppingsService: ShoppingsService) {}

  @Post()
  createList(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateShoppingListDto,
  ) {
    return this.shoppingsService.createList(householdId, me.userId, dto);
  }

  @Get()
  findLists(
    @Param('householdId') householdId: string,
    @Query() { archived }: ListShoppingListsDto,
  ) {
    return this.shoppingsService.findLists(householdId, archived);
  }

  @Get(':listId')
  findList(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return this.shoppingsService.findList(householdId, listId);
  }

  @Patch(':listId')
  updateList(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: UpdateShoppingListDto,
  ) {
    return this.shoppingsService.updateList(householdId, listId, dto);
  }

  @Delete(':listId')
  @HttpCode(204)
  async removeList(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Membership() me: HouseholdMember,
  ) {
    const list = await this.shoppingsService.findList(householdId, listId);
    assertOwnerOrAdmin(me, list.createdById);
    return this.shoppingsService.removeList(householdId, listId);
  }

  @Post(':listId/clear-checked')
  @HttpCode(200)
  clearChecked(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
  ) {
    return this.shoppingsService.clearChecked(householdId, listId);
  }

  // --- Items (any member) ---

  @Post(':listId/items')
  addItem(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: CreateShoppingItemDto,
  ) {
    return this.shoppingsService.addItem(householdId, listId, me.userId, dto);
  }

  @Patch(':listId/items/:itemId')
  updateItem(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateShoppingItemDto,
  ) {
    return this.shoppingsService.updateItem(householdId, listId, itemId, dto);
  }

  @Delete(':listId/items/:itemId')
  @HttpCode(204)
  removeItem(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.shoppingsService.removeItem(householdId, listId, itemId);
  }

  @Post(':listId/items/:itemId/check')
  @HttpCode(200)
  check(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.shoppingsService.setChecked(householdId, listId, itemId, me.userId, true);
  }

  @Delete(':listId/items/:itemId/check')
  uncheck(
    @Param('householdId') householdId: string,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.shoppingsService.setChecked(householdId, listId, itemId, me.userId, false);
  }
}
