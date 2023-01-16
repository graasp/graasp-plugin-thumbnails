import { ReadStream, existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

import { FastifyPluginAsync } from 'fastify';

import {
  FileItemExtra,
  Item,
  ItemType,
  LocalFileItemExtra,
  S3FileItemExtra,
} from '@graasp/sdk';
import basePlugin, { FileTaskManager } from 'graasp-plugin-file';
import { getFilePathFromItemExtra } from 'graasp-plugin-file-item';

import { AppItemExtra, GraaspThumbnailsOptions } from './types';
import {
  THUMBNAIL_FORMAT,
  THUMBNAIL_MIMETYPE,
  THUMBNAIL_PATH_PREFIX,
  THUMBNAIL_SIZES,
  TMP_FOLDER,
} from './utils/constants';
import { UploadFileNotImageError } from './utils/errors';
import { buildFilePathWithPrefix, createThumbnails } from './utils/helpers';

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (
  fastify,
  options,
) => {
  const {
    fileItemType,
    fileConfigurations,
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

  if (fileItemType === ItemType.S3_FILE) {
    if (
      !fileConfigurations?.s3?.s3Region ||
      !fileConfigurations?.s3?.s3Bucket ||
      !fileConfigurations?.s3?.s3AccessKeyId ||
      !fileConfigurations?.s3?.s3SecretAccessKey
    ) {
      throw new Error(
        'graasp-plugin-thumbnails: mandatory options for s3 service missing',
      );
    }
  }

  const fileTaskManager = new FileTaskManager(fileConfigurations, fileItemType);

  const buildFilePath = (itemId: string, filename: string) =>
    buildFilePathWithPrefix({ itemId, pathPrefix, filename });

  fastify.register(basePlugin, {
    fileItemType, // S3 or local
    buildFilePath,
    fileConfigurations,

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

      // it might not be saved correctly in the original upload

      const fileStorage = path.join(__dirname, TMP_FOLDER, itemId);
      mkdirSync(fileStorage, { recursive: true });
      // Warning: assume stream is defined with a filepath
      const thumbnails = await createThumbnails(
        file.path as string,
        itemId,
        fileStorage,
      );
      const thumbnailGenerationTasks = thumbnails.map(
        ({ name, size, fileStream }) =>
          fileTaskManager.createUploadFileTask(member, {
            file: fileStream,
            filepath: buildFilePath(itemId, name),
            mimetype: THUMBNAIL_MIMETYPE,
            size,
          }),
      );

      const tasksFromOptions =
        (await options?.uploadPostHookTasks?.(data, auth)) ?? [];

      return [...thumbnailGenerationTasks, ...tasksFromOptions];
    },
    uploadOnResponse: async ({ query, log }) => {
      const itemId = (query as { id: string })?.id as string;
      const fileStorage = path.join(__dirname, TMP_FOLDER, itemId);
      // delete tmp files after endpoint responded
      if (existsSync(fileStorage)) {
        rmSync(fileStorage, { recursive: true });
      } else {
        // do not throw if folder has already been deleted
        log?.error(`${fileStorage} was not found, and was not deleted`);
      }
    },
    downloadPreHookTasks: options.downloadPreHookTasks,
    downloadPostHookTasks: options.downloadPostHookTasks,
  });

  if (enableItemsHooks) {
    const deleteFileTaskName = itemTaskManager.getDeleteTaskName();
    runner.setTaskPostHookHandler<Item>(
      deleteFileTaskName,
      async ({ id }, actor, { log = defaultLogger, handler }) => {
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
          // No need to wait for thumbnail deletion
          // DON'T use task runner for file task: this would generate a new transaction
          // which is useless since the file task should not touch the DB at all
          // TODO: replace when the file plugin has been refactored into a proper file service
          // DON'T use forEach or Promise.all: we want the transaction to succeed even if some thumbnail creation subtask fails
          // No need to await that they are finished
          Promise.allSettled(tasks.map((t) => t.run(handler, log)));
        } catch (err) {
          log.error(err);
        }
      },
    );

    const copyItemTaskName = itemTaskManager.getCopyTaskName();
    runner.setTaskPostHookHandler<Item>(
      copyItemTaskName,
      async (item, actor, { log = defaultLogger, handler }, { original }) => {
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
          // No need to wait for thumbnail copy
          // DON'T use task runner for file task: this would generate a new transaction
          // which is useless since the file task should not touch the DB at all
          // TODO: replace when the file plugin has been refactored into a proper file service
          // DON'T use forEach or Promise.all: we want the transaction to succeed even if some thumbnail creation subtask fails
          // No need to await that they are finished
          Promise.allSettled(tasks.map((t) => t.run(handler, log)));
        } catch (err) {
          log.error(err);
        }
      },
    );

    const createTaskName = itemTaskManager.getCreateTaskName();
    runner.setTaskPostHookHandler<Item>(
      createTaskName,
      async (item, actor, { log = defaultLogger, handler }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for s3file and file images
        if (
          (type === ItemType.S3_FILE &&
            (extra as S3FileItemExtra)?.s3File?.mimetype.startsWith('image')) ||
          (type === ItemType.LOCAL_FILE &&
            (extra as LocalFileItemExtra)?.file?.mimetype.startsWith('image'))
        ) {
          try {
            // create tmp folder
            const fileStorage = path.join(__dirname, TMP_FOLDER, id);
            mkdirSync(fileStorage, { recursive: true });

            // get original image
            const filepath = getFilePathFromItemExtra(
              fileItemType,
              item.extra as FileItemExtra,
            );
            const task = fileTaskManager.createDownloadFileTask(actor, {
              filepath,
              itemId: item.id,
              fileStorage,
            });

            // DON'T use task runner for file task: this would generate a new transaction
            // which is useless since the file task should not touch the DB at all
            // TODO: replace when the file plugin has been refactored into a proper file service
            await task.run(handler, log);
            const imageStream = task.result as ReadStream;

            // Warning: assume stream is defined with a filepath
            const thumbnails = await createThumbnails(
              imageStream.path as string,
              item.id,
              fileStorage,
            );

            // create thumbnails for new image
            const tasks = thumbnails.map(({ name, size, fileStream }) => {
              return fileTaskManager.createUploadFileTask(actor, {
                file: fileStream,
                filepath: buildFilePath(id, name),
                mimetype: THUMBNAIL_FORMAT,
                size,
              });
            });

            // DON'T use task runner for file task: this would generate a new transaction
            // which is useless since the file task should not touch the DB at all
            // TODO: replace when the file plugin has been refactored into a proper file service
            await Promise.all(tasks.map((t) => t.run(handler, log)));
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
      async (item, actor, { log = defaultLogger, handler }) => {
        const { id, type, extra = {} } = item;

        // generate automatically thumbnails for apps
        if (type === ItemType.APP) {
          const appId = (
            await appService.getAppIdByUrl(
              (extra as AppItemExtra).app.url,
              handler,
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

            // DON'T use task runner for file task: this would generate a new transaction
            // which is useless since the file task should not touch the DB at all
            // TODO: replace when the file plugin has been refactored into a proper file service
            // DON'T use forEach or Promise.all: we want the transaction to succeed even if some thumbnail creation subtask fails
            await Promise.allSettled(tasks.map((t) => t.run(handler, log)));
          }
        }
      },
    );
  }
};

export default plugin;
