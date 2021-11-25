import { createHash } from 'crypto';
import { THUMBNAIL_PREFIX } from './constants';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const buildFilePathFromId = (id: string) =>
  hash(id)
    .match(/.{1,8}/g)
    .join('/');

export const buildFilePath = (itemId: string, pathPrefix: string, filename: string) => {
  const filepath = buildFilePathFromId(itemId);
  return `${THUMBNAIL_PREFIX}${pathPrefix}${filepath}/${filename}`;
};