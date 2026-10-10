import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { Alert, AlertType } from './entities/alert.entity.js';
import { AlertAck } from './entities/alert-ack.entity.js';
import { CreateAlertDto, ListAlertsDto } from './dto/alert.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { NotificationType } from '../notifications/entities/notification.entity.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

/** Anti-spam: one member can't fire more than this many alerts per window */
const MAX_ALERTS_PER_WINDOW = 3;
const WINDOW_MS = 10 * 60 * 1000;

const LABELS: Record<AlertType, string> = {
  [AlertType.FIRE]: 'Fire',
  [AlertType.MEDICAL]: 'Medical emergency',
  [AlertType.INTRUSION]: 'Intrusion',
  [AlertType.WATER_LEAK]: 'Water leak',
  [AlertType.GAS]: 'Gas leak',
  [AlertType.POWER]: 'Power outage',
  [AlertType.OTHER]: 'Emergency',
};

/**
 * Socket events: alert:new, alert:ack, alert:resolved — sent to every
 * active member, sender included (for their other devices).
 */
@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(AlertAck) private readonly acks: Repository<AlertAck>,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(householdId: string, senderId: string, dto: CreateAlertDto) {
    const recent = await this.alerts.count({
      where: {
        householdId,
        senderId,
        createdAt: MoreThan(new Date(Date.now() - WINDOW_MS)),
      },
    });
    if (recent >= MAX_ALERTS_PER_WINDOW) {
      throw new BadRequestException(
        'Too many alerts sent recently, please wait a few minutes',
      );
    }

    const saved = await this.alerts.save(
      this.alerts.create({ ...dto, householdId, senderId }),
    );
    const alert = await this.findOne(householdId, saved.id);

    const who = alert.sender?.firstname ?? 'A housemate';
    await this.notifications.notifyHousehold(
      householdId,
      {
        type: NotificationType.ALERT,
        title: `🚨 ${LABELS[alert.type]}${alert.location ? ` — ${alert.location}` : ''}`,
        body: alert.message ? `${who}: ${alert.message}` : `Sent by ${who}`,
        data: { alertId: alert.id, alertType: alert.type },
      },
      [senderId],
    );
    await this.realtime.emitToHousehold(householdId, 'alert:new', alert);
    return alert;
  }

  findAll(householdId: string, { active }: ListAlertsDto) {
    return this.alerts.find({
      where: { householdId, ...(active && { resolvedAt: IsNull() }) },
      relations: { sender: true, acks: true },
      select: { sender: PUBLIC_USER },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findOne(householdId: string, id: string) {
    const alert = await this.alerts.findOne({
      where: { id, householdId },
      relations: { sender: true, acks: { user: true } },
      select: {
        sender: PUBLIC_USER,
        acks: { userId: true, ackAt: true, user: PUBLIC_USER },
      },
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  /** "I saw it / I'm on my way" */
  async acknowledge(householdId: string, id: string, userId: string) {
    const alert = await this.findOne(householdId, id);
    await this.acks
      .createQueryBuilder()
      .insert()
      .values({ alertId: alert.id, userId })
      .orIgnore()
      .execute();
    const updated = await this.findOne(householdId, id);
    await this.realtime.emitToHousehold(householdId, 'alert:ack', {
      alertId: id,
      userId,
      acks: updated.acks,
    });
    return updated;
  }

  /** Any member can close an alert once the situation is handled */
  async resolve(householdId: string, id: string, userId: string) {
    const alert = await this.findOne(householdId, id);
    if (alert.resolvedAt) return alert;
    await this.alerts.update(alert.id, {
      resolvedAt: new Date(),
      resolvedById: userId,
    });
    const updated = await this.findOne(householdId, id);
    await this.realtime.emitToHousehold(householdId, 'alert:resolved', updated);
    return updated;
  }
}
