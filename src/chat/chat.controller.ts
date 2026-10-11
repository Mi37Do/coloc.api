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
  Header,
} from '@nestjs/common';
import { ImageUpload } from '../media/image-upload.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ChatService } from './chat.service.js';
import {
  EditMessageDto,
  ListMessagesDto,
  SendMessageDto,
  StartDirectDto,
} from './dto/chat.dto.js';
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
    return this.chatService.listMessages(
      householdId,
      conversationId,
      me.userId,
      query,
    );
  }

  @Post(':conversationId/messages')
  send(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Membership() me: HouseholdMember,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.send(householdId, conversationId, me.userId, dto);
  }

  @Patch(':conversationId/messages/:messageId')
  edit(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Membership() me: HouseholdMember,
    @Body() { body }: EditMessageDto,
  ) {
    return this.chatService.edit(
      householdId,
      conversationId,
      messageId,
      me.userId,
      body,
    );
  }

  @Delete(':conversationId/messages/:messageId')
  @HttpCode(204)
  remove(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.chatService.remove(
      householdId,
      conversationId,
      messageId,
      me.userId,
    );
  }

  /** Up to 10 photos (10 MB each) in the multipart field `files`; then send messages with imageId */
  @Post(':conversationId/images')
  @ImageUpload()
  uploadImages(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Membership() me: HouseholdMember,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.chatService.uploadImages(
      householdId,
      conversationId,
      me.userId,
      files,
    );
  }

  @Get(':conversationId/images/:mediaId/file')
  @Header('Cache-Control', 'private, max-age=86400')
  image(
    @Param('householdId') householdId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
    @Membership() me: HouseholdMember,
  ) {
    return this.chatService.openImage(
      householdId,
      conversationId,
      mediaId,
      me.userId,
    );
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
