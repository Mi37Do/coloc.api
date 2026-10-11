import {
  Controller,
  Get,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { MediaService } from './media.service.js';
import { ImageUpload } from './image-upload.js';
import {
  HouseholdMemberGuard,
  Membership,
} from '../household/household-member.guard.js';
import type { HouseholdMember } from '../household/entities/household-member.entity.js';

/**
 * The household's shared GIF library: any member can add GIFs and send them in chat.
 * Files are served and deleted through /households/:householdId/media/:mediaId.
 */
@ApiBearerAuth()
@UseGuards(HouseholdMemberGuard)
@Controller('households/:householdId/gifs')
export class GifsController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  list(@Param('householdId') householdId: string) {
    return this.mediaService.listLibraryGifs(householdId);
  }

  /** Up to 10 GIFs (10 MB each) in the multipart field `files` */
  @Post()
  @ImageUpload()
  upload(
    @Param('householdId') householdId: string,
    @Membership() me: HouseholdMember,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.mediaService.upload(
      householdId,
      { householdId, libraryGif: true },
      me.userId,
      files,
      ['image/gif'],
    );
  }
}
