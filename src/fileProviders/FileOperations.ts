import { Sharp } from 'sharp';

export default interface FileOperations {
  copyObject(
    originalId: string,
    newId: string,
    size: string,
    memberId: string,
  ): Promise<void>;

  deleteItem(id: string): Promise<void>;

  putObject(
    id: string,
    object: Sharp,
    size: string,
    memberId: string,
  ): Promise<void>;
}
