import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service.js';
import { AlertsController } from './alerts.controller.js';
import { Alert } from './entities/alert.entity.js';
import { AlertAck } from './entities/alert-ack.entity.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, AlertAck]), HouseholdModule],
  controllers: [AlertsController],
  providers: [AlertsService],
})
export class AlertsModule {}
