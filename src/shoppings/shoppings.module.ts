import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingsService } from './shoppings.service.js';
import { ShoppingsController } from './shoppings.controller.js';
import { ShoppingList } from './entities/shopping-list.entity.js';
import { ShoppingItem } from './entities/shopping-item.entity.js';
import { HouseholdModule } from '../household/household.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingList, ShoppingItem]),
    HouseholdModule,
  ],
  controllers: [ShoppingsController],
  providers: [ShoppingsService],
})
export class ShoppingsModule {}
