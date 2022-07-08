import FormData from 'form-data';
import fs, { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import { MemberTaskManager } from '@graasp/sdk';
import {
  CannotEditPublicItem,
  CannotEditPublicMember,
  PublicItemTaskManager,
} from 'graasp-plugin-public';
import { ItemTaskManager, Task as MockTask, TaskRunner } from 'graasp-test';

import plugin from '../src/publicPlugin';
import {
  AVATARS_ROUTE,
  ITEMS_ROUTE,
  MEMBERS_ROUTE,
  THUMBNAIL_ROUTE,
  THUMBNAIL_SIZES,
} from '../src/utils/constants';
import build from './app';
import {
  FILE_SERVICES,
  FIXTURE_THUMBNAIL_PATH,
  GET_ITEM_ID,
  GRAASP_ACTOR,
  ITEM_FILE,
  buildPublicFileServiceOptions,
  buildPublicLocalOptions,
  buildPublicS3Options,
} from './constants';
import { mockCreateUploadFileTask } from './mock';

const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();
const publicItemTaskManager = {} as unknown as PublicItemTaskManager;
const memberTaskManager = {} as unknown as MemberTaskManager;

const filepath = path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH);
const fileStream = createReadStream(filepath);

const buildAppOptions = (options) => ({
  plugin,
  publicItemTaskManager,
  itemTaskManager,
  memberTaskManager,
  runner,
  options: {
    ...options,
    downloadPreHookTasks: async () => [new MockTask({ filepath: 'filepath' })],
  },
});

describe('Public Thumbnail Plugin Tests', () => {
  describe('Options', () => {
    beforeEach(() => {
      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(() => true);
      jest
        .spyOn(runner, 'setTaskPreHookHandler')
        .mockImplementation(() => true);
    });

    describe('Local', () => {
      it('Valid options should resolve', async () => {
        const app = await build(buildAppOptions(buildPublicLocalOptions()));
        expect(app).toBeTruthy();
      });
    });

    describe('S3', () => {
      it('Valid options should resolve', async () => {
        const app = await build(buildAppOptions(buildPublicS3Options()));
        expect(app).toBeTruthy();
      });
    });
  });

  describe('Public Items', () => {
    describe.each(FILE_SERVICES)(
      'GET /:id/download?size=<size> for %s',
      (service) => {
        beforeEach(() => {
          jest.clearAllMocks();
          jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
          jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();

          jest
            .spyOn(TaskRunner.prototype, 'runSingleSequence')
            .mockImplementation(async (tasks) => {
              return tasks[0]?.getResult();
            });
        });

        it('Successfully download all different sizes', async () => {
          const mockGetPublicTask = jest
            .fn()
            .mockReturnValue(new MockTask(ITEM_FILE));
          publicItemTaskManager.createGetPublicItemTask = mockGetPublicTask;

          const app = await build(
            buildAppOptions(buildPublicFileServiceOptions(service)),
          );

          for (const { name: size } of Object.values(THUMBNAIL_SIZES)) {
            const res = await app.inject({
              method: 'GET',
              url: `${ITEMS_ROUTE}${THUMBNAIL_ROUTE}/${GET_ITEM_ID}/download?size=${size}`,
            });
            expect(res.statusCode).toBe(StatusCodes.OK);
            // return value is defined in mock runner
            expect(res.body).toBeTruthy();
          }
        });

        it('Throw if item is not public', async () => {
          const error = new Error();
          const mockGetPublicTask = jest
            .fn()
            .mockReturnValue(new MockTask(error));
          publicItemTaskManager.createGetPublicItemTask = mockGetPublicTask;

          const app = await build(
            buildAppOptions(buildPublicFileServiceOptions(service)),
          );

          for (const { name: size } of Object.values(THUMBNAIL_SIZES)) {
            const res = await app.inject({
              method: 'GET',
              url: `${ITEMS_ROUTE}${THUMBNAIL_ROUTE}/${GET_ITEM_ID}/download?size=${size}`,
            });
            // error code depends on mocked error
            expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
          }
        });
      },
    );

    describe.each(FILE_SERVICES)('POST /upload?id=<id> for %s', (service) => {
      beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
        jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
      });

      const form = new FormData();
      form.append('file', fileStream);

      jest.spyOn(fs, 'createReadStream').mockImplementation(() => fileStream);

      it('%s :Throw on upload', async () => {
        const uploadMock = mockCreateUploadFileTask(true);

        jest
          .spyOn(TaskRunner.prototype, 'runMultipleSequences')
          .mockImplementation(async (sequences) => {
            return sequences;
          });

        const app = await build(
          buildAppOptions(buildPublicFileServiceOptions(service)),
        );

        const response = await app.inject({
          method: 'POST',
          url: `${ITEMS_ROUTE}${THUMBNAIL_ROUTE}/upload?id=${GET_ITEM_ID}`,
          payload: form,
          headers: form.getHeaders(),
        });
        const data = response.json();
        const expectedError = new CannotEditPublicItem({
          mimetype: 'image/jpeg',
          parentId: GET_ITEM_ID,
        });
        // upload all thumbnail sizes + original image
        expect(uploadMock).toHaveBeenCalledTimes(0);
        expect(data.message).toBe(expectedError.message);
        expect(data.code).toBe(expectedError.code);
      });
    });
  });

  describe('Public Members', () => {
    describe('GET /:id/download?size=<size>', () => {
      beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
        jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();

        jest
          .spyOn(TaskRunner.prototype, 'runSingleSequence')
          .mockImplementation(async (tasks) => {
            return tasks[0]?.getResult();
          });
      });

      it.each(FILE_SERVICES)(
        '%s :Successfully download all different sizes',
        async (service) => {
          const actor = GRAASP_ACTOR;
          const mockGetTask = jest.fn().mockReturnValue(new MockTask(actor));
          memberTaskManager.createGetTask = mockGetTask;

          const app = await build(
            buildAppOptions(buildPublicFileServiceOptions(service)),
          );

          for (const { name: size } of Object.values(THUMBNAIL_SIZES)) {
            const res = await app.inject({
              method: 'GET',
              url: `${MEMBERS_ROUTE}${AVATARS_ROUTE}/${actor.id}/download?size=${size}`,
            });
            expect(res.statusCode).toBe(StatusCodes.OK);
            // return value is defined in mock runner
            expect(res.body).toBeTruthy();
          }
        },
      );
    });

    describe.each(FILE_SERVICES)('POST /upload?id=<id>', (service) => {
      beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
        jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
      });

      const form = new FormData();
      form.append('file', fileStream);

      jest.spyOn(fs, 'createReadStream').mockImplementation(() => fileStream);

      it('%s :Throw on upload', async () => {
        const uploadMock = mockCreateUploadFileTask(true);

        jest
          .spyOn(TaskRunner.prototype, 'runMultipleSequences')
          .mockImplementation(async (sequences) => {
            return sequences;
          });

        const app = await build(
          buildAppOptions(buildPublicFileServiceOptions(service)),
        );

        const response = await app.inject({
          method: 'POST',
          url: `${MEMBERS_ROUTE}${AVATARS_ROUTE}/upload?id=${GET_ITEM_ID}`,
          payload: form,
          headers: form.getHeaders(),
        });
        const data = response.json();
        const expectedError = new CannotEditPublicMember({
          parentId: GET_ITEM_ID,
          mimetype: 'image/jpeg',
        });
        // upload all thumbnail sizes + original image
        expect(uploadMock).toHaveBeenCalledTimes(0);
        expect(data.message).toBe(expectedError.message);
        expect(data.code).toBe(expectedError.code);
      });
    });
  });
});
