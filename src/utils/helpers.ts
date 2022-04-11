import { createHash } from 'crypto';
import path from 'path';
import { THUMBNAIL_PATH_PREFIX, TMP_FOLDER } from './constants';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const buildFilePathFromId = (id: string): string =>
  hash(id)
    .match(/.{1,8}/g)
    .join('/');

// used for download in public plugin
export const buildFilePathWithPrefix = (options: {
  itemId: string;
  pathPrefix: string;
  filename: string;
}): string => {
  const { itemId, filename, pathPrefix } = options;
  const filepath = buildFilePathFromId(itemId);
  return path.join(THUMBNAIL_PATH_PREFIX, pathPrefix, filepath, filename);
};

export const buildThumbnailPath = (name, itemId) => `${TMP_FOLDER}/${itemId}-${name}`;
