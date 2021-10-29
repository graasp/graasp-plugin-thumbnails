import { Item } from 'graasp';
import { ItemMembershipTaskManager, TaskRunner, Task } from 'graasp-test';

export const mockcreateGetOfItemTaskSequence = (
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
