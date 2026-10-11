import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { User } from './entities/user.entity.js';
import { AvatarsService } from './avatars.service.js';
import { StorageService } from '../media/storage.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, AvatarsService, StorageService],
  exports: [UsersService],
})
export class UsersModule {}
