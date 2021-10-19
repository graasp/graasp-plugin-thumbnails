import contentDisposition from 'content-disposition';
import { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import fs from 'fs';
import { mkdir, unlink } from 'fs/promises';
import { IdParam, UnknownExtra, Item } from 'graasp';
import sharp from 'sharp';

import { upload, download } from './schema';

const ROUTES_PREFIX = '/thumbnails';
const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 250; // 250MB

const randomHexOf4 = () =>
  ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

export interface GraaspFileItemOptions {
  /**
   * Filesystem root path where the uploaded files will be saved
   */
  storageRootPath: string;
}

const plugin: FastifyPluginAsync<GraaspFileItemOptions> = async (
  fastify,
  options,
) => {
  const {
    items: { taskManager },
    taskRunner: runner,
  } = fastify;
  const { storageRootPath } = options;

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

      fastify.post<{ Params: IdParam }>(
        '/:id/upload',
        { schema: upload },
        async (request, reply) => {
          const data = await request.file();
          const { member, params: { id }, log } = request;

          const getItem = taskManager.createGetTaskSequence(member, id);
          const item = (await runner.runSingleSequence(getItem, log)) as Item<UnknownExtra>;

          const path = `${randomHexOf4()}/${randomHexOf4()}`;

          // validate edition of item and add thumbnail path
          // create directories path, 1 folder per item with all sizes
          const storageFilepath = `${storageRootPath}/${path}`;
          await mkdir(`${storageFilepath}`, { recursive: true });

          try {
            // Save path to item and mimetype
            const updateTask = taskManager.createUpdateTaskSequence(member, id, {
              settings: {
                ...item.settings,
                thumbnail:{
                  path: path,
                  mimetype: data.mimetype
                }
              }
            });
            runner.runSingleSequence(updateTask, log);

            const imageBuffer = await data.toBuffer();

            // save original and resized images as with name corresponding to their sizes
            const original = sharp(imageBuffer).toFile(`${storageFilepath}/original`);
            const small = sharp(imageBuffer).resize({ width: 200 }).toFile(`${storageFilepath}/small`);
            const medium = sharp(imageBuffer).resize({ width: 400 }).toFile(`${storageFilepath}/medium`);
            const large = sharp(imageBuffer).resize({ width: 600 }).toFile(`${storageFilepath}/large`);

            Promise.all([small, medium, large, original]);
          } catch (error) {
            // unlink created files
            const original = unlink(`${storageFilepath}/original`);
            const small = unlink(`${storageFilepath}/small`);
            const medium = unlink(`${storageFilepath}/medium`);
            const large = unlink(`${storageFilepath}/large`);
            Promise.all([small, medium, large, original]);

            throw error;
          }

          reply.send();
        },
      );

      fastify.get<{ Params: IdParam, Querystring: { size: string } }>(
        '/:id/download',
        { schema: download },
        async (request, reply) => {
          const { member, params: { id }, query: { size }, log } = request;

          const getItem = taskManager.createGetTaskSequence(member, id);
          const { settings: { thumbnail: { path, mimetype }}} = await runner.runSingleSequence(getItem, log) as Item<UnknownExtra>;

          // Get thumbnail path
          reply.type(mimetype);
          // this header will make the browser download the file with 'name' instead of
          // simply opening it and showing it
          reply.header('Content-Disposition', contentDisposition(`thumb-id-${size}`));
          return fs.createReadStream(`${storageRootPath}/${path}/${size}`);
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
