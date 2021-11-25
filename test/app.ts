import fastify, { FastifyInstance } from 'fastify';
import {
  GraaspS3FileItemOptions,
  GraaspFileItemOptions,
} from 'graasp-plugin-file';
import {
  ItemMembershipTaskManager,
  ItemTaskManager,
  TaskRunner,
} from 'graasp-test';
import plugin, { GraaspThumbnailsOptions } from '../src/index';
import { DISABLE_S3, GRAASP_ACTOR, ROOT_PATH, S3_OPTIONS } from './constants';

const schemas = {
  $id: 'http://graasp.org/',
  definitions: {
    uuid: {
      type: 'string',
      pattern:
        '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
    },
    idParam: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { $ref: '#/definitions/uuid' },
      },
      additionalProperties: false,
    },
  },
};

const build = async ({
  runner,
  taskManager,
  membership,
  S3Options,
  FSOptions,
  options,
}: {
  runner: TaskRunner;
  taskManager: ItemTaskManager;
  membership: ItemMembershipTaskManager;
  S3Options?: GraaspS3FileItemOptions;
  FSOptions?: GraaspFileItemOptions;
  options?: GraaspThumbnailsOptions;
}): Promise<FastifyInstance> => {
  const app = fastify();
  app.addSchema(schemas);

  app.decorateRequest('member', GRAASP_ACTOR);
  app.decorate('taskRunner', runner);
  app.decorate('items', {
    taskManager: taskManager,
  });
  app.decorate('itemMemberships', {
    taskManager: membership,
  });
  app.decorate('fileItemPluginOptions', {
    storageRootPath: FSOptions?.storageRootPath ?? ROOT_PATH,
  });
  app.decorate('s3FileItemPluginOptions', S3Options ?? S3_OPTIONS);

  await app.register(plugin, options ?? DISABLE_S3);

  return app;
};
export default build;
