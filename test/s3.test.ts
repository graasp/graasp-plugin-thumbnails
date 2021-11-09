import FormData from 'form-data';
import { createReadStream } from 'fs';
import { StatusCodes } from 'http-status-codes';
import {
  TaskRunner,
  ItemTaskManager,
  ItemMembershipTaskManager,
} from 'graasp-test';
import build from './app';
import { ENABLE_S3, GET_ITEM_ID, IMAGE_PATH, ITEM_S3_KEY } from './constants';
import { sizes_names } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';
import { S3Provider } from '../src/fileProviders/s3Provider';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Plugin Tests', () => {
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

  describe('GET /thumbnails/:id', () => {
    it('Successfully download all different sizes', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}?size=${size}`,
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
        options: { ...ENABLE_S3, pluginStoragePrefix: 'files' },
      });

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}?size=${size}`,
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
        options: {
          ...ENABLE_S3,
          downloadValidation: async (id, member) =>
            membership.createGetOfItemTaskSequence(member, id),
        },
      });

      const taskManagerError = 'MemberCannotReadItem';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json().message).toBe(taskManagerError);
      }
    });

    it("Can't download non existent item", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: {
          ...ENABLE_S3,
          downloadValidation: async (id, member) =>
            membership.createGetOfItemTaskSequence(member, id),
        },
      });

      const taskManagerError = 'ItemNotFound';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      for (const size of sizes_names) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
        expect(res.json().message).toBe(taskManagerError);
      }
    });
  });

  describe('POST /thumbnails/:id', () => {
    it("Can't upload if doesn't have at least write rights", async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: {
          ...ENABLE_S3,
          uploadValidation: async (id, member) =>
            membership.createGetOfItemTaskSequence(member, id),
        },
      });

      const taskManagerError = 'MemberCannotWriteItem';
      mockcreateGetOfItemTaskSequence(new Error(taskManagerError), true);

      const form = new FormData();
      form.append('file', createReadStream(IMAGE_PATH));

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}`,
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(response.json().message).toBe(taskManagerError);
    });

    it('Upload without files should fail', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}`,
      });

      expect(response.statusCode).toBe(StatusCodes.NOT_ACCEPTABLE);
    });

    it('Successfully upload thumbnail', async () => {
      const put = jest.spyOn(S3Provider.prototype, 'putObject');
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });

      const form = new FormData();
      form.append('file', createReadStream(IMAGE_PATH));

      const response = await app.inject({
        method: 'POST',
        url: `/thumbnails/${GET_ITEM_ID}`,
        payload: form,
        headers: form.getHeaders(),
      });

      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      expect(put).toBeCalledTimes(sizes_names.length);
    });
  });
});
