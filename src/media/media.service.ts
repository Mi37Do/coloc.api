import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Media } from './entities/media.entity.js';
import { StorageService } from './storage.service.js';
import { sniffImage } from './image-upload.js';
import { EventExclusion } from '../events/entities/event-exclusion.entity.js';
import {
  HouseholdMember,
  HouseholdRole,
} from '../household/entities/household-member.entity.js';

export type MediaOwner = { choreId: string } | { eventId: string };

const PUBLIC_USER = { id: true, username: true, firstname: true, lastname: true };

@Injectable()
export class MediaService {
  constructor(
    @InjectRepository(Media) private readonly media: Repository<Media>,
    @InjectRepository(EventExclusion)
    private readonly exclusions: Repository<EventExclusion>,
    private readonly storage: StorageService,
  ) {}

  /** Validates every file first, so a bad file rejects the whole batch */
  async upload(
    householdId: string,
    owner: MediaOwner,
    uploadedById: string,
    files: Express.Multer.File[] | undefined,
  ) {
    if (!files?.length) {
      throw new BadRequestException('Send at least one image in "files"');
    }
    const prepared = files.map((file) => {
      const type = sniffImage(file.buffer);
      if (!type) {
        throw new BadRequestException(
          `${file.originalname} is not a supported image (jpeg, png, webp, gif, heic)`,
        );
      }
      return {
        file,
        type,
        storageKey: `${householdId}/${randomUUID()}.${type.ext}`,
      };
    });

    const saved: string[] = [];
    try {
      for (const { file, storageKey } of prepared) {
        await this.storage.save(storageKey, file.buffer);
        saved.push(storageKey);
      }
      const rows = await this.media.save(
        prepared.map(({ file, type, storageKey }) =>
          this.media.create({
            ...owner,
            householdId,
            uploadedById,
            storageKey,
            originalName: file.originalname.slice(0, 255),
            mimeType: type.mime,
            size: file.size,
          }),
        ),
      );
      return this.list(owner, rows.map((r) => r.id));
    } catch (err) {
      await Promise.all(saved.map((key) => this.storage.delete(key)));
      throw err;
    }
  }

  list(owner: MediaOwner, ids?: string[]) {
    return this.media.find({
      where: { ...owner, ...(ids && { id: In(ids) }) },
      relations: { uploadedBy: true },
      select: { uploadedBy: PUBLIC_USER },
      order: { createdAt: 'ASC' },
    });
  }

  /** Streams the file if the viewer is allowed to see it */
  async open(householdId: string, mediaId: string, viewerId: string) {
    const media = await this.findVisible(householdId, mediaId, viewerId);
    return new StreamableFile(this.storage.stream(media.storageKey), {
      type: media.mimeType,
      length: media.size,
      disposition: `inline; filename="${encodeURIComponent(media.originalName)}"`,
    });
  }

  /** Uploader or admin */
  async remove(householdId: string, mediaId: string, me: HouseholdMember) {
    const media = await this.findVisible(householdId, mediaId, me.userId);
    if (me.role !== HouseholdRole.ADMIN && media.uploadedById !== me.userId) {
      throw new ForbiddenException('Only the uploader or an admin can delete this');
    }
    await this.media.delete(media.id);
    await this.storage.delete(media.storageKey);
  }

  /** Call before deleting a chore/event: DB rows cascade, files don't */
  async removeAllFor(owner: MediaOwner) {
    const rows = await this.media.find({
      where: owner,
      select: { id: true, storageKey: true },
    });
    if (!rows.length) return;
    await this.media.delete({ id: In(rows.map((r) => r.id)) });
    await Promise.all(rows.map((r) => this.storage.delete(r.storageKey)));
  }

  private async findVisible(
    householdId: string,
    mediaId: string,
    viewerId: string,
  ) {
    const media = await this.media.findOne({
      where: { id: mediaId, householdId },
      select: {
        id: true,
        eventId: true,
        uploadedById: true,
        storageKey: true,
        mimeType: true,
        size: true,
        originalName: true,
      },
    });
    const hidden =
      media?.eventId &&
      (await this.exclusions.exists({
        where: { eventId: media.eventId, userId: viewerId },
      }));
    if (!media || hidden) throw new NotFoundException('Media not found');
    return media;
  }
}
