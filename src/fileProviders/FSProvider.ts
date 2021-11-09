import { copyFile, mkdir, rm } from 'fs/promises';
import { GraaspFileItemOptions } from 'graasp-plugin-file-item';
import { Sharp } from 'sharp';
import FileOperations from './FileOperations';
import { createFsFolder, createFsKey } from '../utils/helpers';

export class FSProvider implements FileOperations {
  private readonly options: GraaspFileItemOptions;
  private readonly prefix;

  constructor(options: GraaspFileItemOptions, prefix: string) {
    this.options = options;
    this.prefix = prefix;
  }

  async copyObject(
    originalId: string,
    newId: string,
    size: string,
    _memberId: string,
  ): Promise<void> {
    const { storageRootPath } = this.options;

    await copyFile(
      `${storageRootPath}/${createFsKey(this.prefix, originalId, size)}`,
      `${storageRootPath}/${createFsKey(this.prefix, newId, size)}`,
    );
  }

  async deleteItem(id: string): Promise<void> {
    const { storageRootPath } = this.options;
    await rm(createFsFolder(storageRootPath, this.prefix, id), {
      recursive: true,
    });
  }

  async putObject(
    id: string,
    object: Sharp,
    size: string,
    _memberId: string,
  ): Promise<void> {
    const { storageRootPath } = this.options;
    await mkdir(createFsFolder(storageRootPath, this.prefix, id), {
      recursive: true,
    });

    object.toFile(`${storageRootPath}/${createFsKey(this.prefix, id, size)}`);
  }
}
