import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import build from './app';
import { GET_ITEM_ID, IMAGE_PATH } from './constants';
import { sizes } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Plugin Tests', () => {
  /*  It's currently not possible to test the hooks, because we cannot spy on the fs functions,
  describe('Test hooks', () => {

  });*/

  describe('GET /thumbnails/:id/download', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
      jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
    });

    it('Successfully download all different size', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.body).toBeTruthy();
      }
    });

    it('Can\'t download if not at least read rights', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
      });

      const taskManagerError = 'MemberCannotReadItem';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      }
    });

    it('Can\'t download non existent item', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
      });

      const taskManagerError = 'ItemNotFound';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes) {
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

      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Can\'t upload if not at least write rights', async () => {
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
