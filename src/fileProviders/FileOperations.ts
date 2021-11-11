import { FastifyReply } from 'fastify';
import { ReadStream } from 'fs';
import { Sharp } from 'sharp';

export default interface FileOperations {
  copyObject({
    originalId,
    newId,
    size,
    memberId,
  }: {
    originalId: string;
    newId: string;
    size: string;
    memberId: string;
  }): Promise<void>;

  deleteItem({ id }: { id: string }): Promise<void>;

  putObject({
    id,
    object,
    size,
    memberId,
  }: {
    id: string;
    object: Sharp;
    size: string;
    memberId: string;
  }): Promise<void>;

  getObject({ key }: { key: string }): Promise<Buffer>;

  getObjectUrl({
    reply,
    pluginStoragePrefix,
    id,
    size,
  }: {
    reply: FastifyReply;
    pluginStoragePrefix: string;
    id: string;
    size: string;
  }): Promise<ReadStream> | Promise<void>;
}
