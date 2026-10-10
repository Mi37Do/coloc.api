import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { isUUID } from 'class-validator';
import type { Socket } from 'socket.io';
import { ChatService } from './chat.service.js';
import type { SocketData } from '../realtime/realtime.gateway.js';

/**
 * Client → server chat events. Shares the socket server with
 * RealtimeGateway, which authenticates the connection.
 */
@WebSocketGateway({ cors: { origin: true } })
export class ChatGateway {
  constructor(private readonly chatService: ChatService) {}

  /** emit('chat:typing', { conversationId }) */
  @SubscribeMessage('chat:typing')
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId?: unknown },
  ) {
    const user = (client.data as SocketData).user;
    const conversationId = body?.conversationId;
    if (!user || typeof conversationId !== 'string' || !isUUID(conversationId)) {
      return;
    }
    // Silently ignore conversations the user can't access
    await this.chatService.typing(conversationId, user.id).catch(() => undefined);
  }
}
