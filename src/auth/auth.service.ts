import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service.js';
import { User } from '../users/entities/user.entity.js';
import { InvitesService } from '../household/invites.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import type { JwtPayload } from './jwt.strategy.js';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly invitesService: InvitesService,
    private readonly jwtService: JwtService,
  ) {}

  async register({ password, inviteToken, ...profile }: RegisterDto) {
    // Fail before creating the account if the link is dead
    if (inviteToken) await this.invitesService.preview(inviteToken);

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(profile, passwordHash);
    return this.issue(user, inviteToken);
  }

  async login({ identifier, password, inviteToken }: LoginDto) {
    const user = await this.usersService.findForLogin(identifier);
    const valid =
      user && (await bcrypt.compare(password, user.passwordHash));
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _, ...safeUser } = user;
    return this.issue(safeUser as User, inviteToken);
  }

  private async issue(user: User, inviteToken?: string) {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    const membership = inviteToken
      ? await this.invitesService.accept(inviteToken, user.id)
      : undefined;

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user,
      joinedHouseholdId: membership?.householdId,
    };
  }
}
