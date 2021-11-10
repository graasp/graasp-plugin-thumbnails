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
}
