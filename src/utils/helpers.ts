import { createHash } from 'crypto';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const buildFilePathFromId = (id: string) =>
  hash(id)
    .match(/.{1,8}/g)
    .join('/');
