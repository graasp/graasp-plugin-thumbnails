import { createHash } from 'crypto';
import path from 'path';
import { THUMBNAIL_PREFIX } from './constants';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const buildFilePathFromId = (id: string) =>
  hash(id)
    .match(/.{1,8}/g)
    .join('/');

// used for download in public plugin
export const buildFilePathWithPrefix = (
  options: {
    itemId: string,
    pathPrefix: string,
    filename: string,
  }
) => {
  const { itemId, filename, pathPrefix } = options
  const filepath = buildFilePathFromId(itemId);
  return path.join(THUMBNAIL_PREFIX, pathPrefix, filepath, filename);
};
