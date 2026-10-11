import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service.js';
import { NotificationsController } from './notifications.controller.js';
import { Notification } from './entities/notification.entity.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { DeviceToken } from './entities/device-token.entity.js';
import { PushService } from './push.service.js';
import { DevicesController } from './devices.controller.js';
import { User } from '../users/entities/user.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, DeviceToken, User]), RealtimeModule],
  controllers: [NotificationsController, DevicesController],
  providers: [NotificationsService, PushService],
  exports: [NotificationsService, PushService, RealtimeModule],
})
export class NotificationsModule {}
