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
  ITEM_FILE,
  GRAASP_ACTOR,
} from './constants';
import { sizes } from '../src/utils/constants';
import { mockcreateGetOfItemTaskSequence } from './mock';
import { s3Instance } from '../src/s3Instance';

const taskManager = new ItemTaskManager();
const runner = new TaskRunner();
const membership = new ItemMembershipTaskManager();

describe('Plugin Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(runner, 'setTaskPostHookHandler').mockReturnValue();
    jest.spyOn(runner, 'setTaskPreHookHandler').mockReturnValue();
  });

  describe('Test hooks', () => {
    it('Copy corresponding file on copy task', (done) => {
      const copy = jest.spyOn(s3Instance.prototype, 'copyObject');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getCopyTaskName()) {
            const item = ITEM_FILE;
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(copy).toHaveBeenCalledTimes(4);
            done();
          }
        });
      build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });
    });

    /* It's currently not possible to test the delete hook, because the s3 client always timeout,
    Maybe use something like localstack (https://github.com/localstack/localstack) to mock the AWS endpoints

    it('Delete corresponding file on delete task', (done) => {
      const deletefunc = jest.spyOn(s3Instance.prototype, 'deleteObject');

      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {
          if (name === taskManager.getDeleteTaskName()) {
            const item = ITEM_FILE;
            const actor = GRAASP_ACTOR;
            await fn(item, actor, { log: undefined }, { original: item });
            expect(deletefunc).toHaveBeenCalledTimes(4);
            done();
          }
        });
      build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });
    }); */
  });

  describe('GET /thumbnails/:id/download', () => {
    it('Successfully download all different size', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
      });
      mockcreateGetOfItemTaskSequence({ id: GET_ITEM_ID });

      for (const size of sizes) {
        const res = await app.inject({
          method: 'GET',
          url: `/thumbnails/${GET_ITEM_ID}/download?size=${size}`,
        });

        expect(res.statusCode).toBe(StatusCodes.OK);
        expect(res.json()).toEqual({ key: `${ITEM_S3_KEY}/${size}` });
      }
    });

    it('Can\'t download if not at least read rights', async () => {
      const app = await build({
        taskManager,
        runner,
        membership,
        options: ENABLE_S3,
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
        options: ENABLE_S3,
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
    it('Can\'t upload if not at least write rights', async () => {
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

    /* It's currently not possible to test the AWS upload funciton, because the s3 client always timeout,
    Maybe use something like localstack (https://github.com/localstack/localstack) to mock the AWS endpoints

    it('Successfully upload thumbnail', async () => {

      jest
        .spyOn(runner, 'setTaskPreHookHandler')
        .mockImplementation(async (name, fn) => {});
      jest
        .spyOn(runner, 'setTaskPostHookHandler')
        .mockImplementation(async (name, fn) => {});

    const copy = jest.spyOn(s3Instance.prototype, 'putObject').mockImplementation((name, fn) => Promise.resolve());

      const {
        s3Region: region,
        s3AccessKeyId: accessKeyId,
        s3SecretAccessKey: secretAccessKey,
        s3UseAccelerateEndpoint: useAccelerateEndpoint = false,
      } = S3_OPTIONS;

      const app = await build({
        taskManager,
        runner,
        membership,     
        S3Options: { 
          ...S3_OPTIONS,
          s3Instance : new S3({
            region,
            useAccelerateEndpoint,
            credentials: { accessKeyId, secretAccessKey },
          })
        },
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
    
    expect(copy).toBeCalled();
    expect(response.statusCode).toBe(StatusCodes.OK);
    });*/
  });
});
