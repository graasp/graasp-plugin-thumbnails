import { v4 } from 'uuid'
import {
    TaskRunner,
    ItemTaskManager,
    Task as MockTask,
} from 'graasp-test';
import path from 'path'
import { readFile } from 'fs/promises'
import build from './app';
import { buildLocalOptions, FIXTURE_THUMBNAIL_PATH, GRAASP_ACTOR, ITEM_S3_KEY } from './constants';
import { ITEM_TYPES, THUMBNAIL_MIMETYPE, THUMBNAIL_SIZES } from '../src/utils/constants';
import { FileTaskManager } from 'graasp-plugin-file';

const itemTaskManager = new ItemTaskManager();
const runner = new TaskRunner();

const buildAppOptions = (options) => ({
    itemTaskManager,
    runner,
    options: {
        downloadPreHookTasks: async (
        ) => ([
            new MockTask({ filepath: 'filepath' })
        ]),
        enableItemsHooks: true,
        ...options,
    },
});

describe('Test hooks', () => {
    beforeEach(() => {

        jest.clearAllMocks()

        jest.spyOn(runner, 'runMultiple').mockImplementation(async () => [])
        jest.spyOn(runner, 'runSingle').mockImplementation(async (task) => task.getResult())
    })

    describe('Copy hooks', () => {
        it('Copy corresponding file on copy task', () => {
            const copy =
                jest.spyOn(FileTaskManager.prototype, 'createCopyFileTask').mockImplementation(() => new MockTask(true))
            jest
                .spyOn(runner, 'setTaskPostHookHandler')
                .mockImplementation(async (name, fn) => {
                    if (name === itemTaskManager.getCopyTaskName()) {
                        const item = { id: v4() };
                        const actor = GRAASP_ACTOR;
                        await fn(item, actor, { log: undefined }, { original: item });
                        expect(copy).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length);
                    }
                });

            build(buildAppOptions(buildLocalOptions()));
        });

    });

    describe('Delete hooks', () => {
        it('Delete corresponding file on delete task', (done) => {
            const deleteMock =
                jest.spyOn(FileTaskManager.prototype, 'createDeleteFileTask').mockImplementation(() => new MockTask(true))

            jest
                .spyOn(runner, 'setTaskPostHookHandler')
                .mockImplementation(async (name, fn) => {
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
        it('Creating image should call post hook', async () => {
            const fileBuffer = await readFile(path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH))

            const createMock =
                jest.spyOn(FileTaskManager.prototype, 'createUploadFileTask').mockImplementation(() => new MockTask(true))
            jest.spyOn(FileTaskManager.prototype, 'createGetFileBufferTask').mockImplementation(() => new MockTask(fileBuffer))

            jest
                .spyOn(runner, 'setTaskPostHookHandler')
                .mockImplementation(async (name, fn) => {
                    if (name === itemTaskManager.getCreateTaskName()) {
                        const item = {
                            id: v4(),
                            type: ITEM_TYPES.LOCAL,
                            extra: { file: { mimetype: THUMBNAIL_MIMETYPE, path: `${ITEM_S3_KEY}/filepath` } },
                        };
                        const actor = GRAASP_ACTOR;
                        await fn(item, actor, { log: undefined });
                        expect(createMock).toHaveBeenCalledTimes(4);
                    }
                });

            build(buildAppOptions(buildLocalOptions()));
        });
        it.only('Run post hook only for file items', async () => {

            const createMock =
                jest.spyOn(FileTaskManager.prototype, 'createUploadFileTask').mockImplementation(() => new MockTask(true))

            jest
                .spyOn(runner, 'setTaskPostHookHandler')
                .mockImplementation(async (name, fn) => {
                    if (name === itemTaskManager.getCreateTaskName()) {
                        const item = {
                            id: v4(),
                            type: ITEM_TYPES.APP,
                            extra: { file: { mimetype: THUMBNAIL_MIMETYPE, path: `${ITEM_S3_KEY}/filepath` } },
                        };
                        const actor = GRAASP_ACTOR;
                        await fn(item, actor, { log: undefined });
                        expect(createMock).toHaveBeenCalledTimes(0);
                    }
                });

            build(buildAppOptions(buildLocalOptions()));
        });
        it.only('Run post hook only for image files', async () => {
            const fileBuffer = await readFile(path.resolve(__dirname, FIXTURE_THUMBNAIL_PATH))

            const createMock =
                jest.spyOn(FileTaskManager.prototype, 'createUploadFileTask').mockImplementation(() => new MockTask(true))

            jest
                .spyOn(runner, 'setTaskPostHookHandler')
                .mockImplementation(async (name, fn) => {
                    if (name === itemTaskManager.getCreateTaskName()) {
                        const item = {
                            id: v4(),
                            type: ITEM_TYPES.APP,
                            extra: { file: { mimetype: 'txt', path: `${ITEM_S3_KEY}/filepath` } },
                        };
                        const actor = GRAASP_ACTOR;
                        await fn(item, actor, { log: undefined });
                        expect(createMock).toHaveBeenCalledTimes(0);
                    }
                });

            build(buildAppOptions(buildLocalOptions()));
        });
    });

    //   describe('Test S3 hooks', () => {
    //     it('Copy corresponding file on copy task', (done) => {
    //       const copy = jest.spyOn(S3Provider.prototype, 'copyObject');

    //       jest
    //         .spyOn(runner, 'setTaskPostHookHandler')
    //         .mockImplementation(async (name, fn) => {
    //           if (name === taskManager.getCopyTaskName()) {
    //             const item = { id: v4() };
    //             const actor = GRAASP_ACTOR;
    //             await fn(item, actor, { log: undefined }, { original: item });
    //             expect(copy).toHaveBeenCalledTimes(THUMBNAIL_SIZES.length);
    //             done();
    //           }
    //         });

    //       build({
    //         taskManager,
    //         runner,
    //         membership,
    //         options: { ...ENABLE_S3, enableItemsHooks: true },
    //       });
    //     });

    //     it('Delete corresponding file on delete task', (done) => {
    //       const deletefunc = jest.spyOn(S3Provider.prototype, 'deleteItem');

    //       jest
    //         .spyOn(runner, 'setTaskPostHookHandler')
    //         .mockImplementation(async (name, fn) => {
    //           if (name === taskManager.getDeleteTaskName()) {
    //             const item = { id: v4() };
    //             const actor = GRAASP_ACTOR;
    //             await fn(item, actor, { log: undefined }, { original: item });
    //             expect(deletefunc).toHaveBeenCalled();
    //             done();
    //           }
    //         });

    //       build({
    //         taskManager,
    //         runner,
    //         membership,
    //         options: { ...ENABLE_S3, enableItemsHooks: true },
    //       });
    //     });
    //   });
});
