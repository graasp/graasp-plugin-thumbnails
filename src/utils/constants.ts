export const SMALL = 'small';
export const MEDIUM = 'medium';
export const LARGE = 'large';
export const ORIGINAL = 'original';

export const THUMBNAIL_SIZES = [
  { name: SMALL, width: 200 },
  { name: MEDIUM, width: 400 },
  { name: LARGE, width: 600 },
  { name: ORIGINAL, width: undefined },
];

export const THUMBNAIL_FORMAT = 'jpeg';
export const THUMBNAIL_PREFIX = '/thumbnails';

export const THUMBNAIL_MIMETYPE = 'image/jpeg';

export const ITEM_TYPES = {
  APP: 'app',
  S3: 's3File',
  LOCAL: 'file',
}
