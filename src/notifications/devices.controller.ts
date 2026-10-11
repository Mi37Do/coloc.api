import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { PushService } from './push.service.js';
import { RegisterDeviceDto } from './dto/register-device.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';

/** Phones that receive the current user's push notifications */
@ApiBearerAuth()
@Controller('devices')
export class DevicesController {
  constructor(private readonly push: PushService) {}

  @Post()
  @HttpCode(204)
  register(@CurrentUser() user: AuthUser, @Body() dto: RegisterDeviceDto) {
    return this.push.register(user.id, dto.token, dto.platform);
  }

  @Delete(':token')
  @HttpCode(204)
  unregister(@CurrentUser() user: AuthUser, @Param('token') token: string) {
    return this.push.unregister(user.id, token);
  }
}
