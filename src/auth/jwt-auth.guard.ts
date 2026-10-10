import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/public.decorator.js';
import { ALLOW_UNVERIFIED_KEY } from './decorators/allow-unverified.decorator.js';
import type { AuthUser } from './decorators/current-user.decorator.js';

/**
 * Registered globally; every route needs a JWT unless marked @Public(),
 * and a confirmed email unless marked @AllowUnverified().
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) {
      return true;
    }
    if (!(await super.canActivate(context))) return false;

    const user = context.switchToHttp().getRequest<{ user: AuthUser }>().user;
    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_KEY,
      targets,
    );
    if (!user.emailVerified && !allowUnverified) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirm your email address first',
      });
    }
    return true;
  }
}
