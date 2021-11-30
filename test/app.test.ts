import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import path from 'path'
import {
  TaskRunner,
  ItemTaskManager,
  Task as MockTask,
} from 'graasp-test';
import build from './app';
import { buildFileServiceOptions, buildLocalOptions, buildS3Options, FILE_SERVICES, FIXTURE_THUMBNAIL_PATH, FIXTURE_TXT_PATH, GET_ITEM_ID, GRAASP_ACTOR, ITEM_S3_KEY, } from './constants';
import { mockCreateUploadFileTask } from './mock';
import { v4 } from 'uuid'
import { readFile } from 'fs/promises'
import { ITEM_TYPES, THUMBNAIL_MIMETYPE, THUMBNAIL_SIZES } from '../src/utils/constants';
import { FileTaskManager } from 'graasp-plugin-file';


const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();

const buildAppOptions = (options) => ({
  itemTaskManager,
  runner,
  options: {
    ...options,
    downloadPreHookTasks: (async (
    ) => ([
      new MockTask({ filepath: 'filepath' })
    ])),
  },
});

describe('Thumbnail Plugin Tests', () => {

  describe("Options", () => {
    beforeEach(() => {
      jest.spyOn(runner, "setTaskPostHookHandler").mockImplementation(() => { });
      jest.spyOn(runner, "setTaskPreHookHandler").mockImplementation(() => { });
    });

    describe("Local", () => {
      it("Valid options should resolve", async () => {
        const app = await build(buildAppOptions(buildLocalOptions()));
        expect(app).toBeTruthy();
        const app1 = await build(buildAppOptions(buildLocalOptions({ pathPrefix: "/hello" })))
        expect(app1).toBeTruthy();
      });
    });

    describe("S3", () => {
      it("Valid options should resolve", async () => {
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

    it.each(FILE_SERVICES)('%s :Successfully download all different sizes', async (service) => {
      const app = await build(buildAppOptions(buildFileServiceOptions(service)));

      for (const { name: size } of Object.values(THUMBNAIL_SIZES)) {
        const res = await app.inject({
          method: 'GET',
          url: `/${GET_ITEM_ID}/download?size=${size}`,
        });
        expect(res.statusCode).toBe(StatusCodes.OK);
        // return value is defined in mock runner
        expect(res.body).toBeTruthy();
      }
    });
  });

  describe('POST /upload?id=<id>', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
      jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
    });

    it.each(FILE_SERVICES)('%s :Successfully upload thumbnail', async (service) => {
      const uploadMock = mockCreateUploadFileTask(true)

      jest
        .spyOn(TaskRunner.prototype, 'runMultipleSequences')
        .mockImplementation(async (sequences) => {
          return sequences
        });

      const app = await build(buildAppOptions(buildFileServiceOptions(service)));

      const form = new FormData();
      form.append('file', createReadStream(path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH)));

      const response = await app.inject({
        method: 'POST',
        url: `/upload?id=${GET_ITEM_ID}`,
        payload: form,
        headers: form.getHeaders(),
      });

      // upload all thumbnail sizes + original image
      expect(uploadMock).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length + 1)
      expect(response.statusCode).toBe(StatusCodes.OK);
    });


    it.each(FILE_SERVICES)('%s : Throw if try to upload a non-image file', async (service) => {
      const uploadMock = mockCreateUploadFileTask(true)

      jest
        .spyOn(TaskRunner.prototype, 'runMultipleSequences')
        .mockImplementation(async (sequences) => {
          return sequences
        });

      const app = await build(buildAppOptions(buildFileServiceOptions(service)));

      const form = new FormData();
      form.append('file', createReadStream(path.resolve(__dirname, FIXTURE_TXT_PATH)));

      expect(
        async () => await app.inject({
          method: 'POST',
          url: `/upload`,
          payload: form,
          headers: form.getHeaders(),
        })
      ).rejects.toThrow(Error);
      expect(uploadMock).not.toBeCalled()
    });
  });
});
