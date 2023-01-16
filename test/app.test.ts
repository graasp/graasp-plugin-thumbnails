import FormData from 'form-data';
import fs, { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import { ItemTaskManager, Task as MockTask, TaskRunner } from '@graasp/test';

import plugin from '../src/index';
import { THUMBNAIL_SIZES } from '../src/utils/constants';
import { UploadFileNotImageError } from '../src/utils/errors';
import build from './app';
import {
  FILE_SERVICES,
  FIXTURE_THUMBNAIL_PATH,
  FIXTURE_TXT_PATH,
  GET_ITEM_ID,
  buildFileServiceOptions,
  buildLocalOptions,
  buildS3Options,
} from './constants';
import { mockCreateUploadFileTask } from './mock';

const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();

const filepath = path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH);
const fileStream = createReadStream(filepath);
const textPath = path.resolve(__dirname, FIXTURE_TXT_PATH);
const textFileStream = createReadStream(textPath);

const buildAppOptions = (options) => ({
  plugin,
  itemTaskManager,
  runner,
  options: {
    ...options,
    downloadPreHookTasks: async () => [new MockTask({ filepath: 'filepath' })],
  },
});

describe('Thumbnail Plugin Tests', () => {
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
        const app = await build(buildAppOptions(buildLocalOptions()));
        expect(app).toBeTruthy();
        const app1 = await build(
          buildAppOptions(buildLocalOptions({ pathPrefix: '/hello' })),
        );
        expect(app1).toBeTruthy();
      });
    });

    describe('S3', () => {
      it('Valid options should resolve', async () => {
        const app = await build(buildAppOptions(buildS3Options()));
        expect(app).toBeTruthy();
      });
    });
  });

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
        const app = await build(
          buildAppOptions(buildFileServiceOptions(service)),
        );

        for (const { name: size } of Object.values(THUMBNAIL_SIZES)) {
          const res = await app.inject({
            method: 'GET',
            url: `/${GET_ITEM_ID}/download?size=${size}`,
          });

          expect(res.statusCode).toBe(StatusCodes.OK);
          // return value is defined in mock runner
          expect(res.body).toBeTruthy();
        }
      },
    );
  });

  describe.each(FILE_SERVICES)('POST /upload?id=<id> for %s', (service) => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
      jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
    });

    const form = new FormData();
    form.append('file', fileStream);

    const form1 = new FormData();
    form1.append('file', textFileStream);

    jest.spyOn(fs, 'createReadStream').mockImplementation(() => fileStream);

    it('%s :Successfully upload thumbnail', async () => {
      const uploadMock = mockCreateUploadFileTask(true);

      jest
        .spyOn(TaskRunner.prototype, 'runMultipleSequences')
        .mockImplementation(async (sequences) => {
          return sequences;
        });

      const app = await build(
        buildAppOptions(buildFileServiceOptions(service)),
      );

      const response = await app.inject({
        method: 'POST',
        url: `/upload?id=${GET_ITEM_ID}`,
        payload: form,
        headers: form.getHeaders(),
      });

      // upload all thumbnail sizes + original image
      expect(uploadMock).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length + 1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('%s : Throw if try to upload a non-image file', async () => {
      const uploadMock = mockCreateUploadFileTask(true);

      jest
        .spyOn(TaskRunner.prototype, 'runMultipleSequences')
        .mockImplementation(async (sequences) => {
          return sequences;
        });

      const app = await build(
        buildAppOptions(buildFileServiceOptions(service)),
      );

      const res = await app.inject({
        method: 'POST',
        url: `/upload?id=${GET_ITEM_ID}`,

        payload: form1,
        headers: form1.getHeaders(),
      });

      expect(res.statusCode).toBe(StatusCodes.BAD_REQUEST);
      expect(await res.json()).toEqual(new UploadFileNotImageError());
      expect(uploadMock).not.toBeCalled();
    });
  });
});
