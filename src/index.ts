import contentDisposition from 'content-disposition';
import { FastifyLoggerInstance, FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import { Actor, IdParam, Item, Member, Task } from 'graasp';
import {
  GraaspS3FileItemOptions,
  S3FileItemExtra,
} from 'graasp-plugin-s3-file-item';
import { GraaspFileItemOptions, FileItemExtra } from 'graasp-plugin-file-item';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import sharp from 'sharp';

import { upload, download } from './schema';
import { S3Provider } from './fileProviders/s3Provider';
import { format, sizes, sizes_names } from './utils/constants';
import { FSProvider } from './fileProviders/FSProvider';
import { ITEM_TYPE } from 'graasp-plugin-file-item';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB

declare module 'fastify' {
  interface FastifyInstance {
    s3FileItemPluginOptions?: GraaspS3FileItemOptions;
    fileItemPluginOptions?: GraaspFileItemOptions;
  }
}

export interface GraaspThumbnailsOptions {
  enableS3FileItemPlugin?: boolean;
  enableItemsHooks?: boolean;
  pluginStoragePrefix: string;

  uploadValidation: (
    id: string,
    member: Member,
  ) => Promise<Task<Actor, unknown>[]>;

  downloadValidation: (
    id: string,
    member: Member,
  ) => Promise<Task<Actor, unknown>[]>;
}

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (
  fastify,
  options,
) => {
  const { taskRunner: runner } = fastify;

  const { enableS3FileItemPlugin, enableItemsHooks, pluginStoragePrefix } =
    options;

  fastify.register(async function (fastify) {
    fastify.register(fastifyMultipart, {
      limits: {
        // fieldNameSize: 0,             // Max field name size in bytes (Default: 100 bytes).
        // fieldSize: 1000000,           // Max field value size in bytes (Default: 1MB).
        fields: 0, // Max number of non-file fields (Default: Infinity).
        fileSize: DEFAULT_MAX_FILE_SIZE, // For multipart forms, the max file size (Default: Infinity).
        files: 1, // Max number of file fields (Default: Infinity).
        // headerPairs: 2000             // Max number of header key=>value pairs (Default: 2000 - same as node's http).
      },
    });

    const { storageRootPath } = fastify.fileItemPluginOptions;

    const instance = enableS3FileItemPlugin
      ? new S3Provider(fastify.s3FileItemPluginOptions, pluginStoragePrefix)
      : new FSProvider(fastify.fileItemPluginOptions, pluginStoragePrefix);

    const createAndSaveThumbnails = async (
      id: string,
      imageBuffer: Buffer,
      actor: Actor,
      log: FastifyLoggerInstance,
    ) => {
      const files = sizes.map(({ name, width }) => ({
        size: name,
        image: sharp(imageBuffer).resize({ width }).toFormat(format),
      }));

      await Promise.all(
        files.map(async ({ size, image }) => {
          instance
            .putObject({ id, object: image, size, memberId: actor.id })
            .catch(function (error) {
              log.error(error);
            });
        }),
      );
    };




    if (appHook) {
      const {
        items: { taskManager },
      } = fastify;

      const createItemTaskName = taskManager.getCreateTaskName();
      runner.setTaskPostHookHandler<Item<AppExtra>>(
        createItemTaskName,
        async (item, actor, { log }) => {

          const {
            id,
            type: itemType,
            extra: { app },
          } = item;
          if (
            itemType !== 'app'
          ) {
            return;
          }

          let appThumbnailKey = 1
          if (enableS3FileItemPlugin) {
            appThumbnailKey = 2
          }
          else {
            appThumbnailKey = 3

          }

          await createAndSaveThumbnails(
            id,
            await instance.getObject({
              key: `${storageRootPath}/${file.path}`,
            }),
            actor,
            log,
          );
        }
      );
    }





    if (enableItemsHooks) {
      const {
        items: { taskManager },
      } = fastify;

      // register post create handler to create thumbnails for images
      const createItemTaskName = taskManager.getCreateTaskName();

      if (enableS3FileItemPlugin) {
        runner.setTaskPostHookHandler<Item<S3FileItemExtra>>(
          createItemTaskName,
          async (item, actor, { log }) => {
            const {
              id,
              type: itemType,
              extra: { s3File },
            } = item;
            if (
              itemType !== ITEM_TYPE ||
              !s3File ||
              !s3File.contenttype.startsWith('image')
            )
              return;

            await createAndSaveThumbnails(
              id,
              await instance.getObject({ key: s3File.key }),
              actor,
              log,
            );
          },
        );
      } else {
        runner.setTaskPostHookHandler<Item<FileItemExtra>>(
          createItemTaskName,
          async (item, actor, { log }) => {
            const { id, type: itemType, extra: { file } = {} } = item;
            if (
              itemType !== ITEM_TYPE ||
              !file ||
              !file.mimetype.startsWith('image')
            )
              return;

            await createAndSaveThumbnails(
              id,
              await instance.getObject({
                key: `${storageRootPath}/${file.path}`,
              }),
              actor,
              log,
            );
          },
        );
      }

      // register post delete handler to erase the file
      const deleteItemTaskName = taskManager.getDeleteTaskName();
      runner.setTaskPostHookHandler(
        deleteItemTaskName,
        async ({ id }, _actor, { log }) => {
          instance.deleteItem(id).catch(function (error) {
            log?.error(error);
          });
        },
      );

      // register pre copy handler to make a copy of the 'file item's file
      const copyItemTaskName = taskManager.getCopyTaskName();
      runner.setTaskPostHookHandler(
        copyItemTaskName,
        async ({ id }, actor, { log }, { original }) => {
          await Promise.all(
            sizes_names.map((size) => {
              instance
                .copyObject({
                  originalId: original.id,
                  newId: id,
                  size,
                  memberId: actor.id,
                })
                .catch(function (error) {
                  log?.error(error);
                });
            }),
          );
        },
      );
    }

    fastify.post<{ Params: IdParam }>(
      '/:id',
      { schema: upload },
      async (request, reply) => {
        const data = await request.file();
        const {
          member,
          params: { id },
          log,
        } = request;

        await runner.runSingleSequence(
          await options.uploadValidation(id, member),
          log,
        );

        await createAndSaveThumbnails(id, await data.toBuffer(), member, log);

        reply.status(StatusCodes.NO_CONTENT);
      },
    );

    fastify.get<{ Params: IdParam; Querystring: { size: string } }>(
      '/:id',
      { schema: download },
      async (request, reply) => {
        const {
          member,
          params: { id },
          query: { size },
          log,
        } = request;

        await runner.runSingleSequence(
          await options.downloadValidation(id, member),
          log,
        );

        try {
          return instance.getObjectUrl({
            reply,
            storageRootPath,
            pluginStoragePrefix,
            id,
            size,
          });
        } catch (error) {
          // return 404 if item doesn't have a thumbnail
          reply.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
        }
      },
    );
  });
};

export default plugin;
