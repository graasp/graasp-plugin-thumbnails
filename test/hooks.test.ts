import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import { v4 } from 'uuid';
import build from './app';
import { DISABLE_S3, ENABLE_S3, GRAASP_ACTOR } from './constants';
import { sizes_names } from '../src/utils/constants';
import { FSProvider } from '../src/fileProviders/FSProvider';
import { S3Provider } from '../src/fileProviders/s3Provider';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Test hooks', () => {
  describe('Test File System hooks', () => {
    it('Copy corresponding file on copy task', (done) => {
      const copy = jest.spyOn(FSProvider.prototype, 'copyObject');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getCopyTaskName()) {
            const item = { id: v4() };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(copy).toHaveBeenCalledTimes(sizes_names.length);
            done();
          }
        });

      build({
        taskManager,
        runner,
        membership,
        options: { ...DISABLE_S3, enableItemsHooks: true },
      });
    });

    it('Delete corresponding file on delete task', (done) => {
      const deletefunc = jest.spyOn(FSProvider.prototype, 'deleteItem');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getDeleteTaskName()) {
            const item = { id: v4() };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(deletefunc).toHaveBeenCalled();
            done();
          }
        });

      build({
        taskManager,
        runner,
        membership,
        options: { ...DISABLE_S3, enableItemsHooks: true },
      });
    });
  });

  describe('Test S3 hooks', () => {
    it('Copy corresponding file on copy task', (done) => {
      const copy = jest.spyOn(S3Provider.prototype, 'copyObject');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getCopyTaskName()) {
            const item = { id: v4() };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(copy).toHaveBeenCalledTimes(sizes_names.length);
            done();
          }
        });

      build({
        taskManager,
        runner,
        membership,
        options: { ...ENABLE_S3, enableItemsHooks: true },
      });
    });

    it('Delete corresponding file on delete task', (done) => {
      const deletefunc = jest.spyOn(S3Provider.prototype, 'deleteItem');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getDeleteTaskName()) {
            const item = { id: v4() };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(deletefunc).toHaveBeenCalled();
            done();
          }
        });

      build({
        taskManager,
        runner,
        membership,
        options: { ...ENABLE_S3, enableItemsHooks: true },
      });
    });
  });
});
