import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { Conversation } from './entities/conversation.entity.js';
import { ConversationMember } from './entities/conversation-member.entity.js';
import { Message } from './entities/message.entity.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMember, Message]),
    // Also brings NotificationsModule → RealtimeGateway
    HouseholdModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
})
export class ChatModule {}
