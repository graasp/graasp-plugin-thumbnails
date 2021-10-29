import { copyFile, mkdir, rm } from 'fs/promises';
import { GraaspFileItemOptions } from 'graasp-plugin-file-item';
import { Sharp } from 'sharp';
import FileOperations from './FileOperations';
import { createFsFolder, createFsKey } from '../utils/helpers';

export class FSProvider implements FileOperations {
  private readonly options: GraaspFileItemOptions;

  constructor(options: GraaspFileItemOptions) {
    this.options = options;
  }

  async copyObject(
    originalId: string,
    newId: string,
    _memberId: string,
    size: string,
  ): Promise<void> {
    const { storageRootPath } = this.options;

    await copyFile(
      `${storageRootPath}/${createFsKey(originalId, size)}`,
      `${storageRootPath}/${createFsKey(newId, size)}`,
    );
  }

  async deleteItem(id: string): Promise<void> {
    const { storageRootPath } = this.options;
    await rm(createFsFolder(storageRootPath, id), { recursive: true });
  }

  async putObject(
    id: string,
    object: Sharp,
    _memberId: string,
    size: string,
  ): Promise<void> {
    const { storageRootPath } = this.options;
    await mkdir(createFsFolder(storageRootPath, id), {
      recursive: true,
    });

    object.toFile(`${storageRootPath}/${createFsKey(id, size)}`);
  }
}
