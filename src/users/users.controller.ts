import { Body, Controller, Delete, Get, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';

@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @Delete('me')
  remove(@CurrentUser() user: AuthUser) {
    return this.usersService.remove(user.id);
  }

  /** Find someone to invite into a household */
  @Get('search')
  search(@CurrentUser() user: AuthUser, @Query() { q }: SearchUsersDto) {
    return this.usersService.search(q, user.id);
  }
}
