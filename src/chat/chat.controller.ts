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
import { ChatService } from './chat.service.js';
import { ListMessagesDto, SendMessageDto, StartDirectDto } from './dto/chat.dto.js';
import {
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/conversations')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /** The household group chat plus your direct chats, with unread counts */
  @Get()
  list(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.chatService.list(householdId, me.userId);
  }

  /** Opens (or reuses) the direct chat with another member */
  @Post('direct')
  startDirect(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @Body() { userId }: StartDirectDto,
  ) {
    return this.chatService.startDirect(householdId, me.userId, userId);
  }

  @Get(':conversationId/messages')
  listMessages(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Membership() me: HouseholdMember,
    @Query() query: ListMessagesDto,
  ) {
    return this.chatService.listMessages(householdId, conversationId, me.userId, query);
  }

  @Post(':conversationId/messages')
  send(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Membership() me: HouseholdMember,
    @Body() { body }: SendMessageDto,
  ) {
    return this.chatService.send(householdId, conversationId, me.userId, body);
  }

  @Patch(':conversationId/messages/:messageId')
  edit(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Membership() me: HouseholdMember,
    @Body() { body }: SendMessageDto,
  ) {
    return this.chatService.edit(householdId, conversationId, messageId, me.userId, body);
  }

  @Delete(':conversationId/messages/:messageId')
  @HttpCode(204)
  remove(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.chatService.remove(householdId, conversationId, messageId, me.userId);
  }

  @Post(':conversationId/read')
  @HttpCode(204)
  markRead(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.chatService.markRead(householdId, conversationId, me.userId);
  }
}
