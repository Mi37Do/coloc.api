import { UseInterceptors, applyDecorators } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';

export const MAX_FILES_PER_UPLOAD = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Accepts up to 10 images (≤10 MB each) in the multipart field `files` */
export const ImageUpload = () =>
  applyDecorators(
    UseInterceptors(
      FilesInterceptor('files', MAX_FILES_PER_UPLOAD, {
        storage: memoryStorage(),
        limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES_PER_UPLOAD },
      }),
    ),
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string', format: 'binary' } },
        },
      },
    }),
  );

/**
 * Detects the real image type from the file's first bytes; the client's
 * Content-Type and file extension can't be trusted.
 */
export function sniffImage(
  buf: Buffer,
): { mime: string; ext: string } | null {
  const ascii = (start: number, end: number) =>
    buf.subarray(start, end).toString('latin1');

  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') {
    return { mime: 'image/png', ext: 'png' };
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') {
    return { mime: 'image/gif', ext: 'gif' };
  }
  // iPhone photos: ISO-BMFF container with a HEIC/HEIF brand
  if (ascii(4, 8) === 'ftyp' && /^(heic|heix|mif1|msf1)$/.test(ascii(8, 12))) {
    return { mime: 'image/heic', ext: 'heic' };
  }
  return null;
}
