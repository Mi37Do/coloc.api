import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import type { Server, Socket } from 'socket.io';
import {
  HouseholdMember,
  MembershipStatus,
} from '../household/entities/household-member.entity.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtPayload } from '../auth/jwt.strategy.js';

const userRoom = (userId: string) => `user:${userId}`;

/** Socket.data after a successful handshake */
export interface SocketData {
  user?: AuthUser;
}

/**
 * Single socket.io endpoint. Clients connect with
 * `io(url, { auth: { token: '<jwt>' } })`.
 *
 * Each socket only joins its own user room; household broadcasts are
 * resolved to the current active members at send time, so leaving a
 * household or being excluded from an event takes effect immediately.
 */
@WebSocketGateway({ cors: { origin: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(HouseholdMember)
    private readonly members: Repository<HouseholdMember>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const header = client.handshake.headers.authorization;
      const token =
        (client.handshake.auth as { token?: string }).token ??
        header?.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('missing token');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      (client.data as SocketData).user = {
        id: payload.sub,
        username: payload.username,
      };
      await client.join(userRoom(payload.sub));
    } catch (err) {
      this.logger.debug(`Rejected socket ${client.id}: ${String(err)}`);
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  emitToUsers(userIds: string[], event: string, payload: unknown) {
    const rooms = [...new Set(userIds)].map(userRoom);
    if (rooms.length) this.server.to(rooms).emit(event, payload);
  }

  /** Every active member of the household, minus `except` */
  async emitToHousehold(
    householdId: string,
    event: string,
    payload: unknown,
    except: string[] = [],
  ) {
    const ids = await this.activeMemberIds(householdId);
    this.emitToUsers(
      ids.filter((id) => !except.includes(id)),
      event,
      payload,
    );
  }

  async activeMemberIds(householdId: string): Promise<string[]> {
    const rows = await this.members.find({
      select: { userId: true },
      where: { householdId, status: MembershipStatus.ACTIVE },
    });
    return rows.map((r) => r.userId);
  }
}
