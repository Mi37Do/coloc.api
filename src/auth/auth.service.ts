import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { InvitesService } from '../household/invites.service.js';
import { MailService } from '../mail/mail.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './jwt.strategy.js';

const BCRYPT_ROUNDS = 12;
const CODE_TTL_MS = 15 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODE_ATTEMPTS = 5;

const hashCode = (code: string) =>
  createHash('sha256').update(code).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitesService: InvitesService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Creates the account and emails a confirmation code. An inviteToken is only
   * validated here; the household is joined once the email is confirmed.
   */
  async register({ password, inviteToken, ...profile }: RegisterDto) {
    // Fail before creating the account if the link is dead
    if (inviteToken) await this.invitesService.preview(inviteToken);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(profile, passwordHash);
    // The account exists either way; if mail is down the user can resend later.
    const codeSent = await this.sendCode(user).then(
      () => true,
      () => false,
    );
    return { ...(await this.issue(user)), codeSent };
  }

  async login({ identifier, password, inviteToken }: LoginDto) {
    const user = await this.usersService.findForLogin(identifier);
    const valid = user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _, ...safeUser } = user;
    return this.issue(safeUser as User, inviteToken);
  }

  /** Confirms the email and returns a fresh token that carries verified: true */
  async verifyEmail(userId: string, code: string) {
    const user = await this.usersService.findForVerification(userId);
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) return this.issue(user);

    const expired =
      !user.verificationCodeHash ||
      !user.verificationCodeExpiresAt ||
      user.verificationCodeExpiresAt < new Date();
    if (expired) {
      throw new BadRequestException('This code has expired, request a new one');
    }
    if (user.verificationAttempts >= MAX_CODE_ATTEMPTS) {
      throw new BadRequestException('Too many attempts, request a new code');
    }

    const matches = timingSafeEqual(
      Buffer.from(hashCode(code)),
      Buffer.from(user.verificationCodeHash!),
    );
    if (!matches) {
      await this.usersService.countFailedVerification(userId);
      throw new BadRequestException('That code is not right');
    }

    return this.issue(await this.usersService.markEmailVerified(userId));
  }

  async resendCode(userId: string) {
    const user = await this.usersService.findForVerification(userId);
    if (!user) throw new UnauthorizedException();
    if (user.emailVerified) {
      throw new BadRequestException('Your email is already confirmed');
    }
    const sentAt = user.verificationCodeSentAt?.getTime() ?? 0;
    const wait = sentAt + RESEND_COOLDOWN_MS - Date.now();
    if (wait > 0) {
      throw new HttpException(
        `Wait ${Math.ceil(wait / 1000)}s before requesting another code`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.sendCode(user);
    return { email: user.email };
  }

  private async sendCode(user: User) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    await this.usersService.setVerificationCode(
      user.id,
      hashCode(code),
      new Date(Date.now() + CODE_TTL_MS),
    );
    await this.mailService.sendVerificationCode(
      user.email,
      user.firstname,
      code,
    );
  }

  private async issue(user: User, inviteToken?: string) {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      verified: user.emailVerified,
    };
    // Unconfirmed accounts can't join yet; the app retries after confirmation.
    const membership =
      inviteToken && user.emailVerified
        ? await this.invitesService.accept(inviteToken, user.id)
        : undefined;

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        username: user.username,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        emailVerified: user.emailVerified,
      },
      joinedHouseholdId: membership?.householdId,
    };
  }
}
