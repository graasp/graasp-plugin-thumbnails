import { createHash } from 'crypto';
import contentDisposition from 'content-disposition';
import { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import fs from 'fs';
import fetch from 'node-fetch';
import { mkdir, rm, copyFile } from 'fs/promises';
import { IdParam } from 'graasp';
import { GraaspS3FileItemOptions } from 'graasp-plugin-s3-file-item';
import { GraaspFileItemOptions } from 'graasp-plugin-file-item';
import sharp from 'sharp';

import { upload, download } from './schema';
import { s3Instance } from './s3Instance';

const ROUTES_PREFIX = '/thumbnails';
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB

const hash = (id: string) => createHash('sha256').update(id).digest('hex');

declare module 'fastify' {
  interface FastifyInstance {
    s3FileItemPluginOptions?: GraaspS3FileItemOptions;
    fileItemPluginOptions?: GraaspFileItemOptions;
  }
}

export interface GraaspThumbnailsOptions {
  enableS3FileItemPlugin?: boolean;
}

const plugin: FastifyPluginAsync<GraaspThumbnailsOptions> = async (
  fastify,
  options,
) => {
  const {
    items: { taskManager: item },
    taskRunner: runner,
    itemMemberships: { taskManager: membership },
  } = fastify;

  const { enableS3FileItemPlugin } = options;

  fastify.register(
    async function (fastify) {
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

      // register post delete handler to erase the file
      const deleteItemTaskName = item.getDeleteTaskName();
      runner.setTaskPostHookHandler(
        deleteItemTaskName,
        async ({ id }, _actor, { log }) => {
          if (enableS3FileItemPlugin) {
            const s3instance = new s3Instance(fastify.s3FileItemPluginOptions);

            await Promise.all(
              ['small', 'medium', 'large', 'original'].map((size) =>
                s3instance.deleteObject(`${hash(id)}/${size}`),
              ),
            );
          } else {
            rm(`${storageRootPath}/${hash(id)}`, { recursive: true }).catch(
              function (error) {
                log.error(error);
              },
            );
          }
        },
      );

      // register pre copy handler to make a copy of the 'file item's file
      const copyItemTaskName = item.getCopyTaskName();
      runner.setTaskPostHookHandler(
        copyItemTaskName,
        async ({ id }, actor, { log }, { original }) => {
          if (enableS3FileItemPlugin) {
            const s3instance = new s3Instance(fastify.s3FileItemPluginOptions);

            await Promise.all(
              ['small', 'medium', 'large', 'original'].map((size) =>
                s3instance.copyObject(
                  `${hash(original.id)}/${size}`,
                  `${hash(id)}/${size}`,
                  {
                    member: actor.id,
                    item: id,
                  },
                ),
              ),
            );
          } else {
            const originalPath = `${storageRootPath}/${hash(original.id)}`;
            const newPath = `${storageRootPath}/${hash(id)}`;

            await Promise.all(
              ['small', 'medium', 'large', 'original'].map((size) =>
                copyFile(`${originalPath}/${size}`, `${newPath}/${size}`).catch(
                  function (error) {
                    log.error(error);
                  },
                ),
              ),
            );
          }
        },
      );

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

          const tasks = membership.createGetOfItemTaskSequence(member, id);
          tasks[1].input = { validatePermission: 'write' };
          await runner.runSingleSequence(tasks, log);

          const imageBuffer = await data.toBuffer();
          const original = sharp(imageBuffer).toFormat('jpeg');
          const small = sharp(imageBuffer)
            .resize({ width: 200 })
            .toFormat('jpeg');
          const medium = sharp(imageBuffer)
            .resize({ width: 400 })
            .toFormat('jpeg');
          const large = sharp(imageBuffer)
            .resize({ width: 600 })
            .toFormat('jpeg');

          const sizes = [
            { size: 'small', image: small },
            { size: 'medium', image: medium },
            { size: 'large', image: large },
            { size: 'original', image: original },
          ];

          if (enableS3FileItemPlugin) {
            const s3instance = new s3Instance(fastify.s3FileItemPluginOptions);

            await Promise.all(
              sizes.map(async ({ size, image }) => {
                const url = await s3instance.getSignedUrl(
                  `${hash(id)}/${size}`,
                  {
                    member: member.id,
                    item: id,
                  },
                );
                console.log(url);
                const buffer = await image.toBuffer();
                await fetch(url, {
                  // Your POST endpoint
                  method: 'PUT',
                  body: buffer, // This is your file object
                });
              }),
            );
          } else {
            // validate edition of item and add thumbnail path
            // create directories path, 1 folder per item with all sizes
            const storageFilepath = `${storageRootPath}/${hash(id)}`;
            await mkdir(`${storageFilepath}`, { recursive: true });

            // save original and resized images as with name corresponding to their sizes
            await Promise.all(
              sizes.map(({ size, image }) =>
                image.toFile(`${storageFilepath}/${size}`),
              ),
            );
          }

          reply.send();
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

          // Ensures the member has at least read permissions
          const tasks = membership.createGetOfItemTaskSequence(member, id);
          tasks[1].input = { validatePermission: 'read' };
          await runner.runSingleSequence(tasks, log);

          if (enableS3FileItemPlugin) {
            const key = `${hash(id)}/${size}`;
            reply.send({ key }).status(200);
          } else {
            const { storageRootPath } = fastify.fileItemPluginOptions;

            // Get thumbnail path
            reply.type('image/jpeg');
            // this header will make the browser download the file with 'name' instead of
            // simply opening it and showing it
            reply.header(
              'Content-Disposition',
              contentDisposition(`thumb-id-${size}`),
            );
            return fs.createReadStream(
              `${storageRootPath}/${hash(id)}/${size}`,
            );
          }
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
