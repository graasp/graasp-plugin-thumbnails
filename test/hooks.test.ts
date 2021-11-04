import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import { v4 } from 'uuid';
import build from './app';
import { DISABLE_S3, ENABLE_S3, GET_ITEM_ID, GRAASP_ACTOR } from './constants';
import { sizes_names } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';
import { FSProvider } from '../src/fileProviders/FSProvider';
import { s3Provider } from '../src/fileProviders/s3Provider';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();
/*  It's currently not possible to test the hooks, because we cannot spy on the fs functions, */
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
      const copy = jest.spyOn(s3Provider.prototype, 'copyObject');

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
      const deletefunc = jest.spyOn(s3Provider.prototype, 'deleteItem');

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
