import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import { v4 } from 'uuid';
import build from './app';
import { DISABLE_S3, GET_ITEM_ID, IMAGE_PATH } from './constants';
import { sizes_names } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';
import { FSProvider } from '../src/fileProviders/FSProvider';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Plugin Tests', () => {
  describe('GET /thumbnails/:id/download', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
      jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
    });

    it('Successfully download all different sizes', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toBeTruthy();
      }
    });

    it('Successfully download all different sizes with storage prefix', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        FSOptions: { storageRootPath: './test' },
        options: { ...DISABLE_S3, pluginStoragePrefix: 'files' },
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toBeTruthy();
      }
    });

    it("Can't download if doesn't have at least read rights", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
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

    it('Item without thumbnail should return 404', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
      });
      const id = v4();
      mockcreateGetOfItemTaskSequence({ id });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${id}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.NOT_FOUND);
      }
    });

    it("Can't download non existent item", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
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
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
      jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
    });

    it('Successfully upload thumbnail', async () => {
      const put = jest.spyOn(FSProvider.prototype, 'putObject');
      const app = await build({
        taskManager,
        runner,
        membership,
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

    it('Successfully upload thumbnail with storage prefix', async () => {
      const put = jest.spyOn(FSProvider.prototype, 'putObject');
      const app = await build({
        taskManager,
        runner,
        membership,
        FSOptions: { storageRootPath: './test' },
        options: { ...DISABLE_S3, pluginStoragePrefix: 'files' },
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

    it("Can't upload f doesn't have at least write rights", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
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
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}/upload`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_ACCEPTABLE);
    });
  });
});
