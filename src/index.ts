import contentDisposition from 'content-disposition';
import { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import fs from 'fs';
import { access } from 'fs/promises';
import { Actor, IdParam, Member, Task } from 'graasp';
import { GraaspS3FileItemOptions } from 'graasp-plugin-s3-file-item';
import { GraaspFileItemOptions } from 'graasp-plugin-file-item';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';
import sharp from 'sharp';

import { upload, download } from './schema';
import { s3Provider } from './fileProviders/s3Provider';
import { createFsKey, createS3Key } from './utils/helpers';
import { format, mimetype, sizes } from './utils/constants';
import { FSProvider } from './fileProviders/FSProvider';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB

declare module 'fastify' {
  interface FastifyInstance {
    s3FileItemPluginOptions?: GraaspS3FileItemOptions;
    fileItemPluginOptions?: GraaspFileItemOptions;
  }
}

export interface GraaspThumbnailsOptions {
  enableS3FileItemPlugin?: boolean;
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

  const { enableS3FileItemPlugin, pluginStoragePrefix } = options;

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
      ? new s3Provider(fastify.s3FileItemPluginOptions, pluginStoragePrefix)
      : new FSProvider(fastify.fileItemPluginOptions, pluginStoragePrefix);

    // register post delete handler to erase the file
    /* const deleteItemTaskName = item.getDeleteTaskName();
    runner.setTaskPostHookHandler(
      deleteItemTaskName,
      async ({ id }, _actor, { log }) => {
        instance.deleteItem(id).catch(function (error) {
          log?.error(error);
        });
      },
    );

    // register pre copy handler to make a copy of the 'file item's file
    const copyItemTaskName = item.getCopyTaskName();
    runner.setTaskPostHookHandler(
      copyItemTaskName,
      async ({ id }, actor, { log }, { original }) => {
        await Promise.all(
          sizes_names.map((size) => {
            instance
              .copyObject(original.id, id, actor.id, size)
              .catch(function (error) {
                log?.error(error);
              });
          }),
        );
      },
    );*/

    fastify.post<{ Params: IdParam }>(
      '/:id/upload',
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

        const imageBuffer = await data.toBuffer();
        const files = sizes.map(({ name, width }) => ({
          size: name,
          image: sharp(imageBuffer).resize({ width }).toFormat(format),
        }));

        await Promise.all(
          files.map(async ({ size, image }) => {
            instance
              .putObject(id, image, member.id, size)
              .catch(function (error) {
                log.error(error);
              });
          }),
        );
        reply.status(StatusCodes.NO_CONTENT);
      },
    );

    fastify.get<{ Params: IdParam; Querystring: { size: string } }>(
      '/:id/download',
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

        if (enableS3FileItemPlugin) {
          reply
            .send({ key: createS3Key(pluginStoragePrefix, id, size) })
            .status(200);
        } else {
          try {
            // ensure the file exists, if not throw error
            await access(
              `${storageRootPath}/${createFsKey(
                pluginStoragePrefix,
                id,
                size,
              )}`,
            );

            // Get thumbnail path
            reply.type(mimetype);
            // this header will make the browser download the file with 'name' instead of
            // simply opening it and showing it
            reply.header(
              'Content-Disposition',
              contentDisposition(`thumb-${id}-${size}`),
            );
            return fs.createReadStream(
              `${storageRootPath}/${createFsKey(
                pluginStoragePrefix,
                id,
                size,
              )}`,
            );
          } catch (error) {
            // return 404 if item doesn't have a thumbnail
            reply.status(StatusCodes.NOT_FOUND).send(ReasonPhrases.NOT_FOUND);
          }
        }
      },
    );
  });
};

export default plugin;
