import { Item } from '@graasp/sdk';
import { ItemMembershipTaskManager, Task, TaskRunner } from '@graasp/test';
import { FileTaskManager } from 'graasp-plugin-file';

export const mockCreateGetOfItemTaskSequence = (
  data: Partial<Item> | Error,
  shouldThrow?: boolean,
): jest.SpyInstance => {
  const mockCreateTask = jest
    .spyOn(ItemMembershipTaskManager.prototype, 'createGetOfItemTaskSequence')
    .mockImplementation(() => {
      return [new Task(data), new Task(data)];
    });
  jest
    .spyOn(TaskRunner.prototype, 'runSingleSequence')
    .mockImplementation(async () => {
      if (shouldThrow) throw data;
      return data;
    });
  return mockCreateTask;
};

export const mockCreateUploadFileTask = (
  data: boolean | Error,
  _shouldThrow?: boolean,
): jest.SpyInstance => {
  const mockCreateTask = jest
    .spyOn(FileTaskManager.prototype, 'createUploadFileTask')
    .mockImplementation(() => {
      return new Task(data);
    });
  return mockCreateTask;
};

export const mockSetTaskPostHookHandler = (runner, f) => {
  runner.setTaskPostHookHandler = f;
};
