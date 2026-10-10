import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaService } from './media.service.js';
import { MediaController } from './media.controller.js';
import { StorageService } from './storage.service.js';
import { Media } from './entities/media.entity.js';
import { EventExclusion } from '../events/entities/event-exclusion.entity.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Media, EventExclusion]), HouseholdModule],
  controllers: [MediaController],
  providers: [MediaService, StorageService],
  exports: [MediaService],
})
export class MediaModule {}
