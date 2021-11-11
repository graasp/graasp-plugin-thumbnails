import { copyFile, mkdir, rm } from 'fs/promises';
import { GraaspFileItemOptions } from 'graasp-plugin-file-item';
import { Sharp } from 'sharp';
import FileOperations from './FileOperations';
import { createFsFolder, createFsKey } from '../utils/helpers';
import { readFile, access } from 'fs/promises';
import contentDisposition from 'content-disposition';
import fs from 'fs';
import { mimetype } from '../utils/constants';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

export class FSProvider implements FileOperations {
  private readonly options: GraaspFileItemOptions;
  private readonly prefix: string;

  constructor(options: GraaspFileItemOptions, prefix: string) {
    this.options = options;
    this.prefix = prefix;
  }

  async getObject({ key }: { key: string }): Promise<Buffer> {
    return await readFile(key);
  }

  async getObjectUrl({
    reply,
    storageRootPath,
    pluginStoragePrefix,
    id,
    size,
  }) {
    // ensure the file exists, if not throw error
    try {
      await access(
        `${storageRootPath}/${createFsKey(pluginStoragePrefix, id, size)}`,
      );
    } catch (e) {
      if (e.code === 'ENOENT') {
        return reply
          .status(StatusCodes.NOT_FOUND)
          .send(ReasonPhrases.NOT_FOUND);
      }
      throw e;
    }

    // Get thumbnail path
    reply.type(mimetype);
    // this header will make the browser download the file with 'name' instead of
    // simply opening it and showing it
    reply.header(
      'Content-Disposition',
      contentDisposition(`thumb-${id}-${size}`),
    );
    return fs.createReadStream(
      `${storageRootPath}/${createFsKey(pluginStoragePrefix, id, size)}`,
    );
  }

  async copyObject({
    originalId,
    newId,
    size,
  }: {
    originalId: string;
    newId: string;
    size: string;
  }): Promise<void> {
    const { storageRootPath } = this.options;

    await copyFile(
      `${storageRootPath}/${createFsKey(this.prefix, originalId, size)}`,
      `${storageRootPath}/${createFsKey(this.prefix, newId, size)}`,
    );
  }

  async deleteItem({ id }: { id: string }): Promise<void> {
    const { storageRootPath } = this.options;
    await rm(createFsFolder(storageRootPath, this.prefix, id), {
      recursive: true,
    });
  }

  async putObject({
    id,
    object,
    size,
  }: {
    id: string;
    object: Sharp;
    size: string;
  }): Promise<void> {
    const { storageRootPath } = this.options;
    await mkdir(createFsFolder(storageRootPath, this.prefix, id), {
      recursive: true,
    });

    object.toFile(`${storageRootPath}/${createFsKey(this.prefix, id, size)}`);
  }
}
