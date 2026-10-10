import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, LessThan, Repository } from 'typeorm';
import {
  Conversation,
  ConversationType,
} from './entities/conversation.entity.js';
import { ConversationMember } from './entities/conversation-member.entity.js';
import { Message } from './entities/message.entity.js';
import { ListMessagesDto } from './dto/chat.dto.js';
import { HouseholdService } from '../household/household.service.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  HouseholdMember,
  MembershipStatus,
} from '../household/entities/household-member.entity.js';

const GROUP_KEY = 'group';
const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

/**
 * Socket events pushed to clients:
 *   chat:message          a new message
 *   chat:message:updated  edited or deleted
 *   chat:read             someone read up to a point
 *   chat:typing           someone is typing (see ChatGateway)
 */
@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversations: Repository<Conversation>,
    @InjectRepository(ConversationMember)
    private readonly convMembers: Repository<ConversationMember>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    private readonly householdService: HouseholdService,
    private readonly realtime: RealtimeGateway,
    private readonly dataSource: DataSource,
  ) {}

  /** Group chat + the caller's direct chats, newest activity first */
  async list(householdId: string, userId: string) {
    await this.getOrCreate(householdId, ConversationType.GROUP, GROUP_KEY);

    const rows: Array<{
      id: string;
      type: ConversationType;
      lastMessageAt: Date | null;
      unreadCount: number;
    }> = await this.dataSource.query(
      `SELECT c.id, c.type, c."lastMessageAt",
         (SELECT count(*)::int FROM messages m
           WHERE m."conversationId" = c.id
             AND m."deletedAt" IS NULL
             AND m."senderId" IS DISTINCT FROM $2
             AND m."createdAt" > COALESCE(cm."lastReadAt", '-infinity')
         ) AS "unreadCount"
       FROM conversations c
       LEFT JOIN conversation_members cm
         ON cm."conversationId" = c.id AND cm."userId" = $2
       WHERE c."householdId" = $1
         AND (c.type = 'group' OR cm."userId" IS NOT NULL)
       ORDER BY c."lastMessageAt" DESC NULLS LAST`,
      [householdId, userId],
    );
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);

    const lastMessages: Message[] = await this.messages
      .createQueryBuilder('m')
      .distinctOn(['m.conversationId'])
      .where('m.conversationId IN (:...ids)', { ids })
      .orderBy('m.conversationId')
      .addOrderBy('m.createdAt', 'DESC')
      .getMany();
    const lastById = new Map(lastMessages.map((m) => [m.conversationId, m]));

    const directMembers = await this.convMembers.find({
      where: { conversationId: In(ids) },
      relations: { user: true },
      select: { conversationId: true, userId: true, user: PUBLIC_USER },
    });

    return rows.map((row) => ({
      ...row,
      lastMessage: lastById.get(row.id) ?? null,
      // For direct chats, the other person
      with:
        row.type === ConversationType.DIRECT
          ? (directMembers.find(
              (m) => m.conversationId === row.id && m.userId !== userId,
            )?.user ?? null)
          : null,
    }));
  }

  async startDirect(householdId: string, userId: string, otherId: string) {
    if (otherId === userId) {
      throw new BadRequestException("You can't start a chat with yourself");
    }
    await this.householdService.assertActiveMembers(householdId, [otherId]);

    const key = [userId, otherId].sort().join(':');
    const conversation = await this.getOrCreate(
      householdId,
      ConversationType.DIRECT,
      key,
    );
    await this.convMembers
      .createQueryBuilder()
      .insert()
      .values([
        { conversationId: conversation.id, userId },
        { conversationId: conversation.id, userId: otherId },
      ])
      .orIgnore()
      .execute();
    return conversation;
  }

  async listMessages(
    householdId: string,
    conversationId: string,
    userId: string,
    { before, limit = 50 }: ListMessagesDto,
  ) {
    await this.findAccessible(conversationId, userId, householdId);
    const page = await this.messages.find({
      where: {
        conversationId,
        ...(before && { createdAt: LessThan(new Date(before)) }),
      },
      relations: { sender: true },
      select: { sender: PUBLIC_USER },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    // Oldest first, ready to render
    return page.reverse();
  }

  async send(
    householdId: string,
    conversationId: string,
    userId: string,
    body: string,
  ) {
    const conversation = await this.findAccessible(
      conversationId,
      userId,
      householdId,
    );
    const saved = await this.dataSource.transaction(async (em) => {
      const message = await em.save(
        em.create(Message, { conversationId, senderId: userId, body }),
      );
      await em.update(Conversation, conversationId, {
        lastMessageAt: message.createdAt,
      });
      return message;
    });
    await this.setReadAt(conversationId, userId, saved.createdAt);

    const message = await this.messages.findOneOrFail({
      where: { id: saved.id },
      relations: { sender: true },
      select: { sender: PUBLIC_USER },
    });
    // Sender included, so their other devices update too
    const audience = await this.audience(conversation);
    this.realtime.emitToUsers(audience, 'chat:message', message);
    return message;
  }

  async edit(
    householdId: string,
    conversationId: string,
    messageId: string,
    userId: string,
    body: string,
  ) {
    const { conversation, message } = await this.findOwnMessage(
      householdId,
      conversationId,
      messageId,
      userId,
    );
    message.body = body;
    message.editedAt = new Date();
    await this.messages.save(message);
    this.realtime.emitToUsers(
      await this.audience(conversation),
      'chat:message:updated',
      message,
    );
    return message;
  }

  async remove(
    householdId: string,
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    const { conversation, message } = await this.findOwnMessage(
      householdId,
      conversationId,
      messageId,
      userId,
    );
    message.body = '';
    message.deletedAt = new Date();
    await this.messages.save(message);
    this.realtime.emitToUsers(
      await this.audience(conversation),
      'chat:message:updated',
      message,
    );
  }

  async markRead(householdId: string, conversationId: string, userId: string) {
    const conversation = await this.findAccessible(
      conversationId,
      userId,
      householdId,
    );
    const readAt = new Date();
    await this.setReadAt(conversationId, userId, readAt);
    this.realtime.emitToUsers(await this.audience(conversation), 'chat:read', {
      conversationId,
      userId,
      readAt,
    });
  }

  /** Used by the socket typing indicator */
  async typing(conversationId: string, userId: string) {
    const conversation = await this.findAccessible(conversationId, userId);
    const audience = await this.audience(conversation);
    this.realtime.emitToUsers(
      audience.filter((id) => id !== userId),
      'chat:typing',
      { conversationId, userId },
    );
  }

  /**
   * The conversation, if the user may use it: an active member of its
   * household, and one of the two people for a direct chat.
   */
  private async findAccessible(
    conversationId: string,
    userId: string,
    householdId?: string,
  ) {
    const conversation = await this.conversations.findOne({
      where: { id: conversationId, ...(householdId && { householdId }) },
    });
    const allowed =
      conversation &&
      (await this.dataSource.getRepository(HouseholdMember).exists({
        where: {
          householdId: conversation.householdId,
          userId,
          status: MembershipStatus.ACTIVE,
        },
      })) &&
      (conversation.type === ConversationType.GROUP ||
        (await this.convMembers.exists({ where: { conversationId, userId } })));
    if (!conversation || !allowed) {
      throw new NotFoundException('Conversation not found');
    }
    return conversation;
  }

  private async findOwnMessage(
    householdId: string,
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    const conversation = await this.findAccessible(
      conversationId,
      userId,
      householdId,
    );
    const message = await this.messages.findOne({
      where: { id: messageId, conversationId, deletedAt: IsNull() },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) {
      throw new ForbiddenException('You can only change your own messages');
    }
    return { conversation, message };
  }

  private async audience(conversation: Conversation): Promise<string[]> {
    if (conversation.type === ConversationType.GROUP) {
      return this.realtime.activeMemberIds(conversation.householdId);
    }
    const members = await this.convMembers.find({
      where: { conversationId: conversation.id },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  private async setReadAt(conversationId: string, userId: string, at: Date) {
    await this.convMembers.upsert({ conversationId, userId, lastReadAt: at }, [
      'conversationId',
      'userId',
    ]);
  }

  /** Race-safe: the unique (householdId, directKey) index decides */
  private async getOrCreate(
    householdId: string,
    type: ConversationType,
    directKey: string,
  ) {
    await this.conversations
      .createQueryBuilder()
      .insert()
      .values({ householdId, type, directKey })
      .orIgnore()
      .execute();
    return this.conversations.findOneByOrFail({ householdId, directKey });
  }
}
