import { createHash } from 'crypto';

export const hash = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

export const createS3Key = (prefix: string, id: string, size: string): string =>
  `${prefix}/${hash(id)}/${size}`;
export const createFsKey = (prefix:string, id: string, size: string): string =>
  `${prefix}/${hash(id)}/${size}`;
export const createFsFolder = (root: string, prefix:string,  id: string): string =>
  `${root}/${prefix}/${hash(id)}`;
