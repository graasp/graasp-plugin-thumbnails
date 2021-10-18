import { FastifyPluginAsync } from 'fastify';
import fastifyMultipart from 'fastify-multipart';
import { mkdir } from 'fs/promises';
import { IdParam } from 'graasp';
import sharp from 'sharp';

import { upload } from './schema';

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024 * 250; // 250MB

export interface GraaspFileItemOptions {
  /**
   * Filesystem root path where the uploaded files will be saved
   */
  storageRootPath: string;
}

const ROUTES_PREFIX = '/thumbnails';

const plugin: FastifyPluginAsync<GraaspFileItemOptions> = async (
  fastify,
  options,
) => {
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
          //const { file, filename, mimetype, encoding } = await request.file();
          const data = await request.file();
          const { member, params: { id }, log } = request;
          console.log(id);

          // validate edition of item and add thumbnail path
          // ex: storageFilepath/randX4/randX4/

          // create directories path, 1 folder per item with all sizes
          await mkdir(`${storageRootPath}/test1`, { recursive: true });

          // 'pump' file to directory
          const storageFilepath = `${storageRootPath}/test1/1`;
          //await pump(file, fs.createWriteStream(storageFilepath));

          // save resized images as with name corresponding to their sizes
          const small = sharp(await data.toBuffer()).resize({ width: 200 }).toFile('output.png');

          Promise.all([small]);

          reply.send();
        },
      );
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
