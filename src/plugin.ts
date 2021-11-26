import { FastifyPluginAsync } from 'fastify';
import { Actor, Item, UnknownExtra } from 'graasp';
import sharp from 'sharp';
import basePlugin, { FileTaskManager } from 'graasp-plugin-file';

import {
  DownloadPreHookTasksFunction,
  ServiceMethod,
  UploadPreHookTasksFunction,
  S3FileItemExtra,
  FileItemExtra,
  GraaspFileItemOptions,
  GraaspS3FileItemOptions,
} from 'graasp-plugin-file';

import {
  THUMBNAIL_SIZES,
  THUMBNAIL_FORMAT,
  THUMBNAIL_PREFIX,
} from './utils/constants';
import { buildFilePathFromId } from './utils/helpers';

const FILE_ITEM_TYPES = {
  S3: 's3File',
  LOCAL: 'file',
};

declare module 'fastify' {
  interface FastifyInstance {
    appService?: {
      getAppIdFromUrl?: Function;
    };
  }
}

export interface GraaspThumbnailsOptions {
  serviceMethod: ServiceMethod;

  pathPrefix: string;

  // TODO: use prehook in uploadPrehook.... for public
  uploadPreHookTasks: UploadPreHookTasksFunction;
  downloadPreHookTasks: DownloadPreHookTasksFunction;

  enableItemsHooks?: boolean;
  enableAppsHooks?: {
    appsTemplateRoot: string; // apps/template
  };

  serviceOptions: {
    s3: GraaspS3FileItemOptions;
    local: GraaspFileItemOptions;
  };
}

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (
  fastify,
  options,
) => {
  const {
    serviceMethod,
    serviceOptions,
    pathPrefix,
    enableItemsHooks,
    enableAppsHooks,
  } = options;
  const {
    items: { taskManager: itemTaskManager },
    appService,
    taskRunner: runner,
    log: defaultLogger,
  } = fastify;

  if (!pathPrefix.endsWith('/') || !pathPrefix.startsWith('/')) {
    throw new Error(
      'graasp-plugin-file: local storage service root path is malformed',
    );
  }

  const fileTaskManager = new FileTaskManager(serviceOptions, serviceMethod);

  const buildFilePath = (itemId: string, filename: string) => {
    const filepath = buildFilePathFromId(itemId);
    return `${THUMBNAIL_PREFIX}${pathPrefix}${filepath}/${filename}`;
  };

  const getFileExtra = (
    extra: UnknownExtra,
  ): {
    name: string;
    path: string;
    size: string;
    mimetype: string;
  } => {
    switch (serviceMethod) {
      case ServiceMethod.S3:
        return (extra as S3FileItemExtra).s3File;
      case ServiceMethod.LOCAL:
      default:
        return (extra as FileItemExtra).file;
    }
  };

  const getFilePathFromItemExtra = (extra: UnknownExtra) => {
    return getFileExtra(extra).path;
  };

  const createThumbnails = async (item: Item<UnknownExtra>, actor: Actor) => {
    // get original image
    const filename = getFilePathFromItemExtra(item.extra); //  TODO: get filename from item extra
    const task = fileTaskManager.createGetFileBufferTask(actor, { filename });
    const originalImage = await runner.runSingle(task);

    // generate sizes for given image
    const files = THUMBNAIL_SIZES.map(({ name, width }) => ({
      size: name,
      image: sharp(originalImage).resize({ width }).toFormat(THUMBNAIL_FORMAT),
    }));

    return files;
  };

  fastify.register(basePlugin, {
    serviceMethod, // S3 or local
    buildFilePath: buildFilePath,
    serviceOptions,

    // use function as pre/post hook to avoid infinite loop with thumbnails
    uploadPreHookTasks: options.uploadPreHookTasks,

    uploadPostHookTasks: async ({ file, itemId }, { member }) => {
      const thumbnails = THUMBNAIL_SIZES.map(({ name, width }) => ({
        size: name,
        image: sharp(file).resize({ width }).toFormat(THUMBNAIL_FORMAT),
      }));

      return await Promise.all(
        thumbnails.map(async ({ size: filename, image }) =>
          fileTaskManager.createUploadFileTask(member, {
            file: await image.toBuffer(),
            filename: buildFilePath(itemId, filename),
            mimetype: THUMBNAIL_FORMAT,
          }),
        ),
      );
    },

    downloadPreHookTasks: options.downloadPreHookTasks,
  });

  if (enableItemsHooks) {
    // TODO
    const itemHasThumbnails = async (id: string) => {
      // check item has thumbnails
      const hasThumbnails = true;
      return hasThumbnails;
    };

    const deleteFileTaskName = itemTaskManager.getDeleteTaskName();
    runner.setTaskPostHookHandler<Item>(
      deleteFileTaskName,
      async ({ id, type }, actor, { log = defaultLogger }) => {
        //  check item has thumbnails
        if (await itemHasThumbnails(id)) {
          // delete thumbnails for item
          // TODO: optimize
          const tasks = [];
          for (const { name } of THUMBNAIL_SIZES) {
            const filepath = buildFilePath(id, name);
            const task = fileTaskManager.createDeleteFileTask(actor, {
              filepath,
            });
            tasks.push(task);
          }
          // no need to wait for thumbnails to be deleted
          runner.runMultiple(tasks, log);
        }
      },
    );

    const copyItemTaskName = itemTaskManager.getCopyTaskName();
    runner.setTaskPostHookHandler<Item>(
      copyItemTaskName,
      async (item, actor, { log = defaultLogger }, { original }) => {
        const { id } = item; // full copy with new `id`

        // TODO: check item has thumbnails
        if (await itemHasThumbnails(id)) {
          // copy thumbnails for copied item
          const tasks = [];
          for (const { name: filename } of THUMBNAIL_SIZES) {
            const originalPath = buildFilePath(original.id, filename);
            const newFilePath = buildFilePath(id, filename);

            const task = fileTaskManager.createCopyFileTask(actor, {
              newId: id,
              originalPath,
              newFilePath,
              mimetype: THUMBNAIL_FORMAT,
            });
            tasks.push(task);
          }
          // no need to wait
          runner.runMultiple(tasks, log);
        }
      },
    );

    const createTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(
      createTaskName,
      async (item, actor, { log = defaultLogger }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for s3file and file images
        if (
          (type === FILE_ITEM_TYPES.S3 &&
            (extra as S3FileItemExtra)?.s3File?.mimetype.startsWith('image')) ||
          (type === FILE_ITEM_TYPES.LOCAL &&
            (extra as FileItemExtra)?.file?.mimetype.startsWith('image'))
        ) {
          const thumbnails = await createThumbnails(item, actor);
          // create thumbnails for new image

          const tasks = await Promise.all(
            thumbnails.map(async ({ size: filename, image }) =>
              fileTaskManager.createUploadFileTask(actor, {
                file: await image.toBuffer(),
                filename: buildFilePath(id, filename),
                mimetype: THUMBNAIL_FORMAT,
              }),
            ),
          );

          await runner.runMultiple(tasks, log);
        }
      },
    );
  }

  if (enableAppsHooks) {
    interface AppItemExtra extends UnknownExtra {
      app: {
        url: string;
        settings: UnknownExtra;
      };
    }

    const ITEM_APP_TYPE = 'app';

    const { appsTemplateRoot } = enableAppsHooks;

    const buildAppsTemplatesRoot = (appId: string, name: string) =>
      `${THUMBNAIL_PREFIX}/${appsTemplateRoot}/${appId}/${name}`;

    const createTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(
      createTaskName,
      async (item, actor, { log = defaultLogger }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for apps
        if (type === ITEM_APP_TYPE) {
          const appId = appService.getAppIdFromUrl(
            (extra as AppItemExtra).app.url,
          );

          // copy thumbnails of app template for copied item
          const tasks = THUMBNAIL_SIZES.map(({ name }) =>
            fileTaskManager.createCopyFileTask(actor, {
              newId: id,
              originalPath: buildAppsTemplatesRoot(appId, name),
              newFilePath: buildFilePath(id, name),
              mimetype: THUMBNAIL_FORMAT,
            }),
          );

          await runner.runMultiple(tasks, log);
        }
      },
    );
  }
};

export default plugin;
