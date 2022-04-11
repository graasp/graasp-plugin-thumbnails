import { FastifyPluginAsync } from 'fastify';
import { Actor, Item, UnknownExtra } from 'graasp';
import sharp, { Sharp } from 'sharp';
import { Stream } from 'stream';
import fs, { mkdirSync, ReadStream } from 'fs';
import path from 'path';
import basePlugin, { FileTaskManager, ServiceMethod } from 'graasp-plugin-file';
import { getFilePathFromItemExtra } from 'graasp-plugin-file-item';
import {
  S3FileItemExtra,
  LocalFileItemExtra,
  FileItemExtra,
} from 'graasp-plugin-file';

import {
  THUMBNAIL_SIZES,
  THUMBNAIL_FORMAT,
  THUMBNAIL_PATH_PREFIX,
  ITEM_TYPES,
  THUMBNAIL_MIMETYPE,
  TMP_FOLDER,
} from './utils/constants';
import { buildFilePathWithPrefix, buildThumbnailPath } from './utils/helpers';
import { AppItemExtra, GraaspThumbnailsOptions } from './types';
import { UploadFileNotImageError } from './utils/errors';

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
    db,
  } = fastify;

  if (!options.downloadPreHookTasks) {
    throw new Error('graasp-plugin-thumbnails: downloadPreHookTasks missing');
  }

  if (serviceMethod === ServiceMethod.S3) {
    if (
      !serviceOptions?.s3?.s3Region ||
      !serviceOptions?.s3?.s3Bucket ||
      !serviceOptions?.s3?.s3AccessKeyId ||
      !serviceOptions?.s3?.s3SecretAccessKey
    ) {
      throw new Error(
        'graasp-plugin-thumbnails: mandatory options for s3 service missing',
      );
    }
  }

  // create tmp folder
  mkdirSync(TMP_FOLDER, { recursive: true });

  const fileTaskManager = new FileTaskManager(serviceOptions, serviceMethod);

  const buildFilePath = (itemId: string, filename: string) =>
    buildFilePathWithPrefix({ itemId, pathPrefix, filename });

  const createThumbnails = (imageStream: Stream, itemId: string) => {
    // generate sizes for given image
    const files: { size: string; fileStream: ReadStream }[] = [];
    Promise.all(THUMBNAIL_SIZES.map(async ({ name, width }) => {
      // save resize image in tmp
      const pipeline = sharp().resize({ width }).toFormat(THUMBNAIL_FORMAT);
      const filepath = buildThumbnailPath(name, itemId);
      await imageStream.pipe(pipeline).toFile(filepath);

      files.push({
        size: name,
        fileStream: fs.createReadStream(filepath)
      });
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
        throw new UploadFileNotImageError();
      }

      return options?.uploadPreHookTasks?.(data, auth);
    },

    uploadPostHookTasks: async (data, auth) => {
      const { file, itemId } = data;
      const { member } = auth;
      // const thumbnails = THUMBNAIL_SIZES.map(({ name, width }) => ({
      //   size: name,
      //   image: sharp().resize({ width }).toFormat(THUMBNAIL_FORMAT).pipe(file),
      // }));

      // it might not be saved correctly in the original upload
      const thumbnails = createThumbnails(file, itemId);
      const thumbnailGenerationTasks = thumbnails.map(({ size, fileStream }) =>
        fileTaskManager.createUploadFileTask(member, {
          file: fileStream,
          filepath: buildFilePath(itemId, size),
          mimetype: THUMBNAIL_MIMETYPE,
        }),
      );

      const tasksFromOptions =
        (await options?.uploadPostHookTasks?.(data, auth)) ?? [];

      return [...thumbnailGenerationTasks, ...tasksFromOptions];
    },
    downloadPreHookTasks: options.downloadPreHookTasks,
    downloadPostHookTasks: options.downloadPostHookTasks,
  });

  if (enableItemsHooks) {
    const deleteFileTaskName = itemTaskManager.getDeleteTaskName();
    runner.setTaskPostHookHandler<Item>(
      deleteFileTaskName,
      async ({ id }, actor, { log = defaultLogger }) => {
        //  check item has thumbnails
        try {
          // await access(buildFilePath(id, undefined))
          // delete thumbnails for item
          const tasks = THUMBNAIL_SIZES.map(({ name }) => {
            const filepath = buildFilePath(id, name);
            return fileTaskManager.createDeleteFileTask(actor, {
              filepath,
            });
          });
          // no need to wait for thumbnails to be deleted
          runner.runMultiple(tasks, log);
        } catch (err) {
          log.error(err);
        }
      },
    );

    const copyItemTaskName = itemTaskManager.getCopyTaskName();
    runner.setTaskPostHookHandler<Item>(
      copyItemTaskName,
      async (item, actor, { log = defaultLogger }, { original }) => {
        const { id } = item; // full copy with new `id`
        try {
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
          });
          // no need to wait
          runner.runMultiple(tasks, log);
        } catch (err) {
          log.error(err);
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
          try {
            // get original image
            const filepath = getFilePathFromItemExtra(
              serviceMethod,
              item.extra as FileItemExtra,
            );
            const task = fileTaskManager.createDownloadFileTask(actor, {
              filepath,
              itemId: item.id,
            });
            const imageStream = (await runner.runSingle(task)) as Stream;

            const thumbnails = createThumbnails(imageStream, item.id);

            // create thumbnails for new image
            const tasks = thumbnails.map(({ size: filename, fileStream }) => {
              return fileTaskManager.createUploadFileTask(actor, {
                file: fileStream,
                filepath: buildFilePath(id, filename),
                mimetype: THUMBNAIL_FORMAT,
              });
            });

            await runner.runMultiple(tasks, log);
          } catch (err) {
            log.error(err);
          }
        }
      },
    );
  }

  if (enableAppsHooks) {
    const { appsTemplateRoot, itemsRoot } = enableAppsHooks;

    const buildAppsTemplatesRoot = (appId: string, name: string) =>
      path.join(THUMBNAIL_PATH_PREFIX, appsTemplateRoot, appId, name);

    const createTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(
      createTaskName,
      async (item, actor, { log = defaultLogger }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for apps
        if (type === ITEM_TYPES.APP) {
          const appId = (
            await appService.getAppIdByUrl(
              (extra as AppItemExtra).app.url,
              db.pool,
            )
          )?.id;

          // copy thumbnails of app template for copied item
          if (appId) {
            const tasks = THUMBNAIL_SIZES.map(({ name }) =>
              fileTaskManager.createCopyFileTask(actor, {
                newId: id,
                originalPath: buildAppsTemplatesRoot(appId, name),
                newFilePath: buildFilePathWithPrefix({
                  itemId: id,
                  pathPrefix: itemsRoot,
                  filename: name,
                }),
                mimetype: THUMBNAIL_MIMETYPE,
              }),
            );

            await runner.runMultiple(tasks, log);
          }
        }
      },
    );
  }
};

export default plugin;
