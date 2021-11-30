import { FastifyPluginAsync } from 'fastify';
import { Actor, Item, UnknownExtra } from 'graasp';
import sharp from 'sharp';
import basePlugin, { FileTaskManager, ServiceMethod } from 'graasp-plugin-file';
import { getFilePathFromItemExtra } from 'graasp-plugin-file-item'
import {
  S3FileItemExtra,
  LocalFileItemExtra,
  FileItemExtra
} from 'graasp-plugin-file';

import {
  THUMBNAIL_SIZES,
  THUMBNAIL_FORMAT,
  THUMBNAIL_PREFIX,
  ITEM_TYPES, THUMBNAIL_MIMETYPE
} from './utils/constants';
import { buildFilePathFromId, buildFilePathWithPrefix } from './utils/helpers';
import { AppItemExtra, GraaspThumbnailsOptions } from './types';

declare module 'fastify' {
  interface FastifyInstance {
    appService?: {
      getAppIdFromUrl?: Function;
    };
  }
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

  if (serviceMethod === ServiceMethod.S3) {
    if (
      !serviceOptions?.s3?.s3Region ||
      !serviceOptions?.s3?.s3Bucket ||
      !serviceOptions?.s3?.s3AccessKeyId ||
      !serviceOptions?.s3?.s3SecretAccessKey
    ) {
      throw new Error(
        "graasp-plugin-thumbnails: mandatory options for s3 service missing"
      );
    }
  }

  const fileTaskManager = new FileTaskManager(serviceOptions, serviceMethod);

  const buildFilePath = (itemId: string, filename: string) => buildFilePathWithPrefix({ itemId, pathPrefix, filename })


  const createThumbnails = async (item: Item<UnknownExtra>, actor: Actor) => {
    // get original image
    const filename = getFilePathFromItemExtra(serviceMethod, item.extra as FileItemExtra); //  TODO: get filename from item extra
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
    uploadPreHookTasks: (data, auth) => {
      // check file is an image
      if (!data.mimetype.includes('image')) {
        throw new Error("File is not an image")
      }

      return options?.uploadPreHookTasks?.(data, auth)
    },

    uploadPostHookTasks: async ({ file, itemId }, { member }) => {
      const thumbnails = THUMBNAIL_SIZES.map(({ name, width }) => ({
        size: name,
        image: sharp(file).resize({ width }).toFormat(THUMBNAIL_FORMAT),
      }));

      // todo: do not upload original thumbnail ? 
      // it might not be saved correctly in the original upload
      return await Promise.all(
        thumbnails.map(async ({ size: filename, image }) =>
          fileTaskManager.createUploadFileTask(member, {
            file: await image.toBuffer(),
            filepath: buildFilePath(itemId, filename),
            mimetype: THUMBNAIL_MIMETYPE,
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
      async ({ id }, actor, { log = defaultLogger }) => {
        //  check item has thumbnails
        if (await itemHasThumbnails(id)) {
          // delete thumbnails for item
          const tasks = THUMBNAIL_SIZES.map(({ name }) => {
            const filepath = buildFilePath(id, name);
            return fileTaskManager.createDeleteFileTask(actor, {
              filepath,
            });
          })
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
          const tasks = THUMBNAIL_SIZES.map(({ name: filename }) => {
            const originalPath = buildFilePath(original.id, filename);
            const newFilePath = buildFilePath(id, filename);

            return fileTaskManager.createCopyFileTask(actor, {
              newId: id,
              originalPath,
              newFilePath,
              mimetype: THUMBNAIL_MIMETYPE,
            });
          })
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
          (type === ITEM_TYPES.S3 &&
            (extra as S3FileItemExtra)?.s3File?.mimetype.startsWith('image')) ||
          (type === ITEM_TYPES.LOCAL &&
            (extra as LocalFileItemExtra)?.file?.mimetype.startsWith('image'))
        ) {

          const thumbnails = await createThumbnails(item, actor);


          // create thumbnails for new image
          const tasks = await Promise.all(
            thumbnails.map(async ({ size: filename, image }) =>
              fileTaskManager.createUploadFileTask(actor, {
                file: await image.toBuffer(),
                filepath: buildFilePath(id, filename),
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

    const { appsTemplateRoot } = enableAppsHooks;

    const buildAppsTemplatesRoot = (appId: string, name: string) =>
      `${THUMBNAIL_PREFIX}/${appsTemplateRoot}/${appId}/${name}`;

    const createTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(
      createTaskName,
      async (item, actor, { log = defaultLogger }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for apps
        if (type === ITEM_TYPES.APP) {
          const appId = appService.getAppIdFromUrl(
            (extra as AppItemExtra).app.url,
          );

          // copy thumbnails of app template for copied item
          const tasks = THUMBNAIL_SIZES.map(({ name }) =>
            fileTaskManager.createCopyFileTask(actor, {
              newId: id,
              originalPath: buildAppsTemplatesRoot(appId, name),
              newFilePath: buildFilePath(id, name),
              mimetype: THUMBNAIL_MIMETYPE,
            }),
          );

          await runner.runMultiple(tasks, log);
        }
      },
    );
  }
};

export default plugin;