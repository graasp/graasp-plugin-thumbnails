import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import path from 'path';
import { v4 } from 'uuid';

import { ItemType } from '@graasp/sdk';
import { ItemTaskManager, Task as MockTask, TaskRunner } from '@graasp/test';
import { FileTaskManager } from 'graasp-plugin-file';

import plugin from '../src/plugin';
import { THUMBNAIL_MIMETYPE, THUMBNAIL_SIZES } from '../src/utils/constants';
import build from './app';
import {
  FILE_SERVICES,
  FIXTURE_THUMBNAIL_PATH,
  GRAASP_ACTOR,
  ITEM_S3_KEY,
  buildFileServiceOptions,
  buildLocalOptions,
} from './constants';
import { mockSetTaskPostHookHandler } from './mock';

const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();

const filepath = path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH);
const fileStream = createReadStream(filepath);

const buildAppOptions = (options) => ({
  itemTaskManager,
  plugin,
  runner,
  options: {
    downloadPreHookTasks: async () => [new MockTask({ filepath: 'filepath' })],
    enableItemsHooks: true,
    ...options,
  },
});

let app;

describe('Item hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Copy hooks', () => {
    beforeEach(() => {
      jest.spyOn(runner, 'runMultiple').mockImplementation(async () => []);
      jest
        .spyOn(runner, 'runSingle')
        .mockImplementation(async (task) => task.getResult?.());
    });
    afterEach(() => {
      app?.close();
    });
    it.each(FILE_SERVICES)(
      '%s : Copy corresponding file on copy task',
      async (service) => {
        const copy = jest
          .spyOn(FileTaskManager.prototype, 'createCopyFileTask')
          .mockImplementation(() => new MockTask(true));
        mockSetTaskPostHookHandler(runner, async (name, fn) => {
          if (name === itemTaskManager.getCopyTaskName()) {
            const item = { id: v4() };
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(copy).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length);
          }
        });

        app = await build(buildAppOptions(buildFileServiceOptions(service)));
      },
    );
  });

  describe('Delete hooks', () => {
    beforeEach(() => {
      jest.spyOn(runner, 'runMultiple').mockImplementation(async () => []);
      jest
        .spyOn(runner, 'runSingle')
        .mockImplementation(async (task) => task.getResult?.());
    });
    it('Delete corresponding file on delete task', (done) => {
      const deleteMock = jest
        .spyOn(FileTaskManager.prototype, 'createDeleteFileTask')
        .mockImplementation(() => new MockTask(true));

      mockSetTaskPostHookHandler(runner, async (name, fn) => {
        if (name === itemTaskManager.getDeleteTaskName()) {
          const item = { id: v4() };
          const actor = GRAASP_ACTOR;
          await fn(item, actor, { log: undefined }, { original: item });
          expect(deleteMock).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length);
          done();
        }
      });

      build(buildAppOptions(buildLocalOptions()));
    });
  });
  describe('Create hooks', () => {
    beforeEach(() => {
      jest
        .spyOn(runner, 'runSingle')
        .mockImplementation(async () => fileStream);
    });
    it('Creating image should call post hook', async () => {
      const createMock = jest
        .spyOn(FileTaskManager.prototype, 'createUploadFileTask')
        .mockImplementation(() => new MockTask(true));

      mockSetTaskPostHookHandler(runner, async (name, fn) => {
        if (name === itemTaskManager.getCreateTaskName()) {
          const item = {
            id: v4(),
            type: ItemType.LOCAL_FILE,
            extra: {
              [ItemType.LOCAL_FILE]: {
                mimetype: THUMBNAIL_MIMETYPE,
                path: `${ITEM_S3_KEY}/filepath`,
              },
            },
          };
          const actor = GRAASP_ACTOR;
          await fn(item, actor, { log: undefined });
          expect(createMock).toHaveBeenCalledTimes(4);
        }
      });

      build(buildAppOptions(buildLocalOptions()));
    });
  });
  it.each(FILE_SERVICES)(
    '%s : Run post hook only for file items',
    (service) => {
      const createMock = jest
        .spyOn(FileTaskManager.prototype, 'createUploadFileTask')
        .mockImplementation(() => new MockTask(true));

      mockSetTaskPostHookHandler(runner, async (name, fn) => {
        if (name === itemTaskManager.getCreateTaskName()) {
          const item = {
            id: v4(),
            type: ItemType.APP,
            extra: {
              [ItemType.LOCAL_FILE]: {
                mimetype: THUMBNAIL_MIMETYPE,
                path: `${ITEM_S3_KEY}/filepath`,
              },
            },
          };
          const actor = GRAASP_ACTOR;
          await fn(item, actor, { log: undefined });
          expect(createMock).toHaveBeenCalledTimes(0);
        }
      });

      build(buildAppOptions(buildFileServiceOptions(service)));
    },
  );
  it.each(FILE_SERVICES)(
    '%s : Run post hook only for image files',
    async (service) => {
      const createMock = jest
        .spyOn(FileTaskManager.prototype, 'createUploadFileTask')
        .mockImplementation(() => new MockTask(true));

      mockSetTaskPostHookHandler(runner, async (name, fn) => {
        if (name === itemTaskManager.getCreateTaskName()) {
          const item = {
            id: v4(),
            type: ItemType.APP,
            extra: {
              [ItemType.LOCAL_FILE]: {
                mimetype: 'txt',
                path: `${ITEM_S3_KEY}/filepath`,
              },
            },
          };
          const actor = GRAASP_ACTOR;
          await fn(item, actor, { log: undefined });
          expect(createMock).toHaveBeenCalledTimes(0);
        }
      });

      build(buildAppOptions(buildFileServiceOptions(service)));
    },
  );
});
