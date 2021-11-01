import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import build from './app';
import {
  ENABLE_S3,
  GET_ITEM_ID,
  IMAGE_PATH,
  ITEM_S3_KEY,
} from './constants';
import { sizes_names } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';
import { s3Provider } from '../src/FileProviders/s3Provider';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Plugin Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
    jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
  });

  describe('GET /thumbnails/:id/download', () => {
    it('Successfully download all different sizes', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual({ key: `${ITEM_S3_KEY}/${size}` });
      }
    });

    it('Successfully download all different sizes with storage prefix', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: { ...ENABLE_S3, pluginStoragePrefix: 'files'}
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual({ key: `files/${ITEM_S3_KEY}/${size}` });
      }
    });

    it("Can't download if doesn't have at least read rights", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      const taskManagerError = 'MemberCannotReadItem';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });

    it("Can't download non existent item", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      const taskManagerError = 'ItemNotFound';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });
  });

  describe('POST /thumbnails/:id/upload', () => {
    it("Can't upload if doesn't have at least write rights", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      const taskManagerError = 'MemberCannotWriteItem';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      const form = new FormData();
      form.append('file', createReadStream(IMAGE_PATH));

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}/upload`,
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it('Upload without files should fail', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}/upload`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_ACCEPTABLE);
    });

    it('Successfully upload thumbnail', async () => {
      const put = jest.spyOn(s3Provider.prototype, 'putObject');
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      const form = new FormData();
      form.append('file', createReadStream(IMAGE_PATH));

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}/upload`,
        payload: form,
        headers: form.getHeaders(),
      });
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(put).toBeCalledTimes(sizes_names.length);
    });
  });
});
