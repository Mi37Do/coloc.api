import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import { StorageService } from '../media/storage.service.js';
import { sniffImage } from '../media/image-upload.js';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/** Profile pictures: one per user, replaced on upload */
@Injectable()
export class AvatarsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly storage: StorageService,
  ) {}

  async set(userId: string, file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException('Send an image in "file"');
    const type = sniffImage(file.buffer);
    // HEIC can't be shown by most browsers, so ask for a common format
    if (!type || type.mime === 'image/heic') {
      throw new BadRequestException('Use a JPEG, PNG, WebP or GIF image');
    }
    const previous = await this.findWithKey(userId);
    const key = `avatars/${userId}-${randomUUID()}.${type.ext}`;
    await this.storage.save(key, file.buffer);
    await this.users.update(userId, {
      avatarKey: key,
      avatarMime: type.mime,
      avatarUpdatedAt: new Date(),
    });
    if (previous?.avatarKey) await this.storage.delete(previous.avatarKey);
    return this.users.findOneByOrFail({ id: userId });
  }

  async remove(userId: string) {
    const user = await this.findWithKey(userId);
    await this.users.update(userId, {
      avatarKey: null,
      avatarMime: null,
      avatarUpdatedAt: null,
    });
    if (user?.avatarKey) await this.storage.delete(user.avatarKey);
  }

  async open(userId: string) {
    const user = await this.findWithKey(userId);
    if (!user?.avatarKey || !user.avatarMime) {
      throw new NotFoundException('No profile picture');
    }
    return new StreamableFile(this.storage.stream(user.avatarKey), {
      type: user.avatarMime,
    });
  }

  private findWithKey(userId: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect(['user.avatarKey', 'user.avatarMime'])
      .where('user.id = :userId', { userId })
      .getOne();
  }
}
