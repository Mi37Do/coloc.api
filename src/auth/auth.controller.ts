import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { Public } from './decorators/public.decorator.js';
import { AllowUnverified } from './decorators/allow-unverified.decorator.js';
import {
  CurrentUser,
  type AuthUser,
} from './decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @AllowUnverified()
  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@CurrentUser() user: AuthUser, @Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(user.id, dto.code);
  }

  @ApiBearerAuth()
  @AllowUnverified()
  @Post('resend-code')
  @HttpCode(200)
  resendCode(@CurrentUser() user: AuthUser) {
    return this.authService.resendCode(user.id);
  }
}
