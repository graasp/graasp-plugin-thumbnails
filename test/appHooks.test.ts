import { v4 } from 'uuid';

import { FastifyLoggerInstance } from 'fastify';

import { ItemType } from '@graasp/sdk';
import { FileTaskManager } from 'graasp-plugin-file';
import { ItemTaskManager, Task as MockTask, TaskRunner } from 'graasp-test';

import plugin from '../src/plugin';
import build from './app';
import {
  FILE_SERVICES,
  GRAASP_ACTOR,
  ITEM_S3_KEY,
  buildLocalOptions,
} from './constants';
import { mockSetTaskPostHookHandler } from './mock';

const MOCK_LOGGER = {} as unknown as FastifyLoggerInstance;
const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();

const DEFAULT_APPS_OPTIONS = {
  appsTemplateRoot: 'appsTemplateRoot',
  itemsRoot: 'itemsRoot',
};

const buildAppOptions = (options) => ({
  itemTaskManager,
  runner,
  plugin,
  options: {
    downloadPreHookTasks: async () => [new MockTask({ filepath: 'filepath' })],
    enableItemsHooks: false,
    enableAppsHooks: DEFAULT_APPS_OPTIONS,
    ...options,
  },
  getAppIdByUrl: options.getAppIdByUrl ?? jest.fn(),
});

describe('App hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create hooks', () => {
    beforeEach(() => {
      jest
        .spyOn(runner, 'runSingle')
        .mockImplementation(async (task) => task.getResult?.());
    });
    it('Creating app should call post hook', (done) => {
      jest.spyOn(runner, 'runMultiple').mockImplementation(async () => []);
      const copyMock = jest
        .spyOn(FileTaskManager.prototype, 'createCopyFileTask')
        .mockImplementation(() => new MockTask(true));

      const appUrl = 'appURL';
      const id = v4();
      const getAppIdByUrl = jest.fn().mockResolvedValue({ id });

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === itemTaskManager.getCreateTaskName()) {
            const item = {
              id: v4(),
              type: ItemType.APP,
              extra: {
                [ItemType.APP]: { url: appUrl },
              },
            };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: MOCK_LOGGER });
            expect(copyMock).toHaveBeenCalledTimes(4);
            done();
          }
        });

      build(buildAppOptions({ ...buildLocalOptions(), getAppIdByUrl }));
    });

    it.each(FILE_SERVICES)('%s : Run post hook only for apps', async () => {
      const copyMock = jest
        .spyOn(FileTaskManager.prototype, 'createCopyFileTask')
        .mockImplementation(() => new MockTask(true));

      mockSetTaskPostHookHandler(runner, async (name, fn) => {
        if (name === itemTaskManager.getCreateTaskName()) {
          const item = {
            id: v4(),
            type: ItemType.LOCAL_FILE,
            extra: {
              file: { mimetype: 'txt', path: `${ITEM_S3_KEY}/filepath` },
            },
          };
          const actor = GRAASP_ACTOR;
          await fn(item, actor, { log: undefined });
          expect(copyMock).toHaveBeenCalledTimes(0);
        }
      });
      build(buildAppOptions(buildLocalOptions()));
    });
    it.each(FILE_SERVICES)(
      '%s : Does not throw if app doesnt exist in db',
      async () => {
        const copyMock = jest
          .spyOn(FileTaskManager.prototype, 'createCopyFileTask')
          .mockImplementation(() => new MockTask(true));

        const appUrl = 'appURL';
        const getAppIdByUrl = jest.fn().mockResolvedValue({ id: undefined });

        jest
          .spyOn(runner, 'setTaskPostHookHandler')
          .mockImplementation(async (name, fn) => {
            if (name === itemTaskManager.getCreateTaskName()) {
              const item = {
                id: v4(),
                type: ItemType.APP,
                extra: {
                  [ItemType.APP]: { url: appUrl },
                },
              };
              const actor = GRAASP_ACTOR;
              await fn(item, actor, { log: MOCK_LOGGER });
              expect(copyMock).toHaveBeenCalledTimes(0);
            }
          });

        build(buildAppOptions({ ...buildLocalOptions(), getAppIdByUrl }));
      },
    );
  });
});
