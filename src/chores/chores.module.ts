import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChoresService } from './chores.service.js';
import { ChoresController } from './chores.controller.js';
import { Chore } from './entities/chore.entity.js';
import { HouseholdModule } from '../household/household.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Chore]), HouseholdModule, MediaModule],
  controllers: [ChoresController],
  providers: [ChoresService],
  exports: [ChoresService],
})
export class ChoresModule {}
