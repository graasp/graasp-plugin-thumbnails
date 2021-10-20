import { createHash } from 'crypto';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const createS3Key = (id: string, size: string): string =>
  `${hash(id)}/${size}`;
export const createFsKey = (id: string, size: string): string =>
  `${hash(id)}/${size}`;
export const createFsFolder = (root: string, id: string): string =>
  `${root}/${hash(id)}`;
