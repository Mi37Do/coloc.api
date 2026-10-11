import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { AvatarsService, MAX_AVATAR_BYTES } from './avatars.service.js';
import { ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { SearchUsersDto } from './dto/search-users.dto.js';
import {
  CurrentUser,
  type AuthUser,
} from '../auth/decorators/current-user.decorator.js';
import { AllowUnverified } from '../auth/decorators/allow-unverified.decorator.js';

@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly avatars: AvatarsService,
  ) {}

  /** Profile picture (JPEG, PNG, WebP or GIF, up to 5 MB) in the multipart field `file` */
  @Put('me/avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_AVATAR_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  setAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.avatars.set(user.id, file);
  }

  @Delete('me/avatar')
  @HttpCode(204)
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.avatars.remove(user.id);
  }

  /** Any signed-in user's picture. Clients add ?v=<avatarUpdatedAt> so it can be cached. */
  @Get(':id/avatar')
  @Header('Cache-Control', 'private, max-age=604800')
  avatar(@Param('id', ParseUUIDPipe) id: string) {
    return this.avatars.open(id);
  }

  @AllowUnverified()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.usersService.findById(user.id);
  }

  @Patch('me')
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateUserDto) {
    return this.usersService.update(user.id, dto);
  }

  @AllowUnverified()
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
