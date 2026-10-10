import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

export type PublicUser = Pick<
  User,
  'id' | 'username' | 'firstname' | 'lastname'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async create(dto: CreateUserDto, passwordHash: string): Promise<User> {
    const email = dto.email.toLowerCase();
    await this.assertAvailable(email, dto.username);
    const user = await this.users.save(
      this.users.create({ ...dto, email, passwordHash }),
    );
    return this.findById(user.id);
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /** Loads the password hash, for login only. */
  findForLogin(identifier: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: identifier.toLowerCase() })
      .orWhere('user.username = :username', { username: identifier })
      .getOne();
  }

  /** Exact email match, or username prefix. Only exposes public fields. */
  search(q: string, excludeUserId: string): Promise<PublicUser[]> {
    const term = q.trim();
    const escaped = term.replace(/[\\%_]/g, '\\$&');
    return this.users
      .find({
        select: { id: true, username: true, firstname: true, lastname: true },
        where: [
          { email: term.toLowerCase() },
          { username: ILike(`${escaped}%`) },
        ],
        take: 10,
        order: { username: 'ASC' },
      })
      .then((found) => found.filter((u) => u.id !== excludeUserId));
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    if (dto.username) {
      const taken = await this.users.findOne({
        where: { username: dto.username },
      });
      if (taken && taken.id !== id) {
        throw new ConflictException('Username already taken');
      }
    }
    await this.users.update(id, dto);
    return this.findById(id);
  }

  async remove(id: string): Promise<void> {
    await this.users.delete(id);
  }

  private async assertAvailable(email: string, username: string) {
    const existing = await this.users.findOne({
      where: [{ email }, { username }],
    });
    if (!existing) return;
    throw new ConflictException(
      existing.email === email
        ? 'Email already registered'
        : 'Username already taken',
    );
  }
}
